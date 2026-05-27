import math
import time
from typing import List, Dict, Tuple, Optional

class ScientificProcessor:
    def __init__(self, baseline_window_sec: int = 300, decay_fit_duration_sec: int = 120):
        self.baseline_window_sec = baseline_window_sec
        self.decay_fit_duration_sec = decay_fit_duration_sec
        
        # History buffers
        self.history: List[Dict[str, float]] = []  # List of raw packets: {gas, temp, hum, timestamp}
        self.compensated_gas_history: List[Tuple[float, float]] = []  # List of (timestamp, comp_gas)
        
        # Baseline tracking
        self.baseline: float = 100.0  # Initial baseline guess
        
        # State machine for decay analysis
        # States: "IDLE", "RISING", "DECAYING"
        self.state: str = "IDLE"
        self.injection_timestamp: Optional[float] = None
        self.decay_start_timestamp: Optional[float] = None
        self.c_max: float = 0.0
        self.decay_data_points: List[Tuple[float, float]] = []  # List of (t_offset_seconds, gas_value)
        
        # Latest analysis results
        self.tau: Optional[float] = None
        self.amplitude: Optional[float] = None
        self.stagnation_score: float = 0.0
        self.ventilation_quality: str = "Excellent"
        self.ach: Optional[float] = None
        self.last_event_type: Optional[str] = None
        
    def reset_baseline(self):
        """Resets the baseline to the current raw gas reading."""
        if self.compensated_gas_history:
            self.baseline = self.compensated_gas_history[-1][1]
        else:
            self.baseline = 100.0
        self.tau = None
        self.ach = None
        self.stagnation_score = 0.0
        self.ventilation_quality = "Excellent"
        self.state = "IDLE"
        self.decay_data_points = []
        self.injection_timestamp = None
        self.decay_start_timestamp = None
        self.c_max = 0.0

    def compensate_mq135(self, raw_gas: float, temp: float, hum: float) -> float:
        """
        Compensate MQ135 raw resistance/reading based on Temp/Hum.
        Standard MQ135 resistance ratio decreases as temperature and humidity increase.
        Reference conditions: 20 degrees Celsius, 55% relative humidity.
        """
        # Linear approximation of temperature-humidity impact multiplier
        # Sensitivity curves show gas reading goes UP with temp/hum for the same concentration.
        # So we divide/multiply by a correction factor to normalize it to 20C and 55% RH.
        temp_factor = 1.0 - 0.012 * (temp - 20.0)
        hum_factor = 1.0 - 0.003 * (hum - 55.0)
        correction_factor = temp_factor * hum_factor
        
        # Clip correction factor to avoid division by zero or extreme scaling
        correction_factor = max(0.5, min(correction_factor, 1.8))
        
        # Compensated reading
        return raw_gas / correction_factor

    def update_baseline(self, current_time: float):
        """
        Updates the baseline gas concentration.
        A rolling minimum over the baseline_window_sec (e.g. 5 mins) represents clean air.
        """
        # Filter history to baseline window
        cutoff_time = current_time - self.baseline_window_sec
        recent_compensated = [val for ts, val in self.compensated_gas_history if ts >= cutoff_time]
        
        if len(recent_compensated) > 10:
            # Use the 5th percentile to avoid being overly affected by temporary negative noise spikes
            sorted_recent = sorted(recent_compensated)
            idx = int(len(sorted_recent) * 0.05)
            self.baseline = sorted_recent[idx]
        elif recent_compensated:
            self.baseline = min(recent_compensated)

    def fit_exponential_decay(self) -> Tuple[Optional[float], Optional[float]]:
        """
        Fits the gathered decay data points to the curve:
        C(t) = C_baseline + A * exp(-t / tau)
        
        Taking natural log:
        ln(C(t) - C_baseline) = ln(A) - t / tau
        Let y = ln(C(t) - C_baseline), x = t
        Then y = a + b*x, where a = ln(A) and b = -1/tau.
        
        We solve for a, b using standard linear regression (Least Squares).
        """
        points = self.decay_data_points
        if len(points) < 5:
            return None, None
            
        x_vals = []
        y_vals = []
        
        for t, c in points:
            excess = c - self.baseline
            if excess <= 1.0:
                # If excess drops below 1.0 raw units, log becomes invalid or noisy.
                # Clip excess to a small positive value
                excess = 1.0
            
            x_vals.append(t)
            y_vals.append(math.log(excess))
            
        n = len(points)
        sum_x = sum(x_vals)
        sum_y = sum(y_vals)
        sum_xx = sum(x * x for x in x_vals)
        sum_xy = sum(x * y for x, y in zip(x_vals, y_vals))
        
        denominator = (n * sum_xx - sum_x * sum_x)
        if abs(denominator) < 1e-6:
            return None, None
            
        b = (n * sum_xy - sum_x * sum_y) / denominator
        a = (sum_y - b * sum_x) / n
        
        # If b >= 0, it means concentration is rising or stable, not decaying.
        # tau must be positive (since b = -1/tau, b must be negative).
        if b >= 0:
            return None, None
            
        tau = -1.0 / b
        amplitude = math.exp(a)
        
        return tau, amplitude

    def process_packet(self, packet: Dict[str, float]) -> Dict[str, any]:
        """
        Processes a raw sensor packet and updates the state machine and statistics.
        Returns the processed telemetry packet.
        """
        raw_gas = packet["gas"]
        temp = packet["temp"]
        hum = packet["hum"]
        ts = packet["timestamp"]
        
        # 1. Compensation
        comp_gas = self.compensate_mq135(raw_gas, temp, hum)
        
        # Store in histories
        self.compensated_gas_history.append((ts, comp_gas))
        # Keep histories bounded (e.g. max 1000 items)
        if len(self.compensated_gas_history) > 1000:
            self.compensated_gas_history.pop(0)
            
        # 2. Update Baseline
        self.update_baseline(ts)
        
        # 3. State Machine & Event Tracking
        # Calculate rate of change if we have prior data
        rate_of_change = 0.0
        if len(self.compensated_gas_history) >= 2:
            prev_ts, prev_gas = self.compensated_gas_history[-2]
            dt = ts - prev_ts
            if dt > 0:
                rate_of_change = (comp_gas - prev_gas) / dt
                
        self.last_event_type = None
        
        if self.state == "IDLE":
            # Detect spike: if rate of change is high
            # e.g., VOC rises by > 10 units in 1 sec, and is at least 15% above baseline
            if rate_of_change > 15.0 and comp_gas > self.baseline * 1.1:
                self.state = "RISING"
                self.injection_timestamp = ts
                self.c_max = comp_gas
                self.decay_data_points = []
                self.last_event_type = "INJECTION_START"
                
        elif self.state == "RISING":
            # Update peak concentration
            if comp_gas > self.c_max:
                self.c_max = comp_gas
            
            # Transition to decaying once the signal peaks and drops slightly
            # e.g., rate of change becomes negative and gas drops by 5 units from peak
            if rate_of_change < -2.0 or comp_gas < (self.c_max - 5.0):
                self.state = "DECAYING"
                self.decay_start_timestamp = ts
                # Collect the first point
                self.decay_data_points.append((0.0, comp_gas))
                self.last_event_type = "DECAY_START"
                
        elif self.state == "DECAYING":
            # Verify we are still in decay phase
            t_offset = ts - self.decay_start_timestamp
            
            # If a new injection happens during decay (double spike), reset to rising
            if rate_of_change > 20.0:
                self.state = "RISING"
                self.injection_timestamp = ts
                self.c_max = comp_gas
                self.decay_data_points = []
                self.last_event_type = "INJECTION_START"
            else:
                # Add data point for fitting (up to decay_fit_duration_sec)
                if t_offset <= self.decay_fit_duration_sec:
                    self.decay_data_points.append((t_offset, comp_gas))
                    
                # Run exponential fit
                tau_est, amp_est = self.fit_exponential_decay()
                if tau_est is not None:
                    self.tau = tau_est
                    self.amplitude = amp_est
                    # Calculate Air Changes Per Hour (ACH)
                    # ACH = 3600 / tau
                    self.ach = 3600.0 / self.tau
                    
                    # Update stagnation score & ventilation quality based on estimated Tau
                    # We bound Tau to sensible ranges: [15, 600]
                    # Score: 0 is fast decay (tau=15), 100 is stagnant (tau=300)
                    self.stagnation_score = min(100.0, max(0.0, (self.tau - 25.0) / (300.0 - 25.0) * 100.0))
                    
                    if self.tau < 60.0:
                        self.ventilation_quality = "Excellent"
                    elif self.tau < 180.0:
                        self.ventilation_quality = "Moderate"
                    else:
                        self.ventilation_quality = "Stagnant"
                
                # Check if decay has finished:
                # Either gas concentration returns near baseline (e.g. less than 10% of excess remaining)
                # or we have exceeded decay fit duration.
                excess_remaining = comp_gas - self.baseline
                total_excess = self.c_max - self.baseline
                
                if (total_excess > 0 and excess_remaining < 0.1 * total_excess) or (t_offset > self.decay_fit_duration_sec + 60.0):
                    self.state = "IDLE"
                    self.last_event_type = "DECAY_END"

        # Calculate decay overlay coordinates if in DECAYING state and we have a valid fit
        decay_fit_curve = []
        if self.state == "DECAYING" and self.tau is not None and self.amplitude is not None and self.decay_start_timestamp is not None:
            # Generate expected points for overlay
            for t_idx in range(0, int(ts - self.decay_start_timestamp) + 1, 2):
                fit_val = self.baseline + self.amplitude * math.exp(-t_idx / self.tau)
                decay_fit_curve.append({
                    "time_offset": t_idx,
                    "timestamp": self.decay_start_timestamp + t_idx,
                    "value": fit_val
                })

        return {
            "timestamp": ts,
            "raw_gas": raw_gas,
            "temp": temp,
            "hum": hum,
            "comp_gas": round(comp_gas, 2),
            "baseline": round(self.baseline, 2),
            "state": self.state,
            "rate_of_change": round(rate_of_change, 3),
            "tau": round(self.tau, 1) if self.tau is not None else None,
            "amplitude": round(self.amplitude, 1) if self.amplitude is not None else None,
            "stagnation_score": round(self.stagnation_score, 1),
            "ventilation_quality": self.ventilation_quality,
            "ach": round(self.ach, 2) if self.ach is not None else None,
            "last_event": self.last_event_type,
            "decay_fit_curve": decay_fit_curve,
            "c_max": round(self.c_max, 2) if self.c_max > 0 else None,
            "decay_duration": round(ts - self.decay_start_timestamp, 1) if self.decay_start_timestamp is not None else 0.0
        }
