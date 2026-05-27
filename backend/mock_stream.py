import time
import random
import math
from typing import Dict

class MockStreamGenerator:
    def __init__(self, sampling_interval: float = 1.0):
        self.sampling_interval = sampling_interval
        
        # Room simulation parameters
        self.base_gas = 120.0
        self.current_gas = 120.0
        self.target_gas = 120.0
        
        self.temp_base = 24.5
        self.hum_base = 52.0
        
        # Fan speed simulation
        self.fan_on = False
        
        # Injection event parameters
        self.injection_active = False
        self.injection_peak_value = 450.0
        self.injection_start_time = 0.0
        self.decay_tau = 220.0  # Seconds. Default slow decay (fan off)
        
        # Time step counter for noise generation
        self.step = 0
        
    def set_fan(self, state: bool):
        """Sets fan state which dynamically alters the decay constant."""
        self.fan_on = state
        if self.fan_on:
            # Ventilated decay is very fast
            self.decay_tau = 30.0
        else:
            # Stagnant decay is very slow
            self.decay_tau = 220.0
            
    def trigger_injection(self):
        """Injects a pulse of VOC gas."""
        self.injection_active = True
        self.injection_start_time = time.time()
        # Set target gas to spike immediately, then we will transition to exponential decay
        self.target_gas = self.base_gas + random.uniform(300.0, 450.0)
        
    def reset_baseline(self):
        """Resets the base levels."""
        self.base_gas = 120.0
        self.current_gas = 120.0
        self.target_gas = 120.0
        self.injection_active = False

    def next_sample(self) -> Dict[str, float]:
        """Generates the next sensor packet."""
        self.step += 1
        current_time = time.time()
        
        # 1. Simulate Temp & Humidity with tiny fluctuations and diurnal patterns
        diurnal = math.sin(self.step * 0.01)
        temp = self.temp_base + diurnal * 0.8 + random.uniform(-0.1, 0.1)
        hum = self.hum_base - diurnal * 1.5 + random.uniform(-0.2, 0.2)
        
        # 2. Simulate VOC Gas behavior
        if self.injection_active:
            # We are in the pulse phase or decay phase
            elapsed = current_time - self.injection_start_time
            
            # Pulse phase (rising): first 4 seconds the gas rises rapidly to target_gas
            rise_time = 4.0
            if elapsed < rise_time:
                # Linear/quadratic interpolation to peak
                pct = elapsed / rise_time
                self.current_gas = self.base_gas + (self.target_gas - self.base_gas) * (pct ** 2)
            else:
                # Decay phase: exponential decay towards baseline
                decay_elapsed = elapsed - rise_time
                # C(t) = C_base + (C_peak - C_base) * exp(-t / tau)
                decay_excess = (self.target_gas - self.base_gas) * math.exp(-decay_elapsed / self.decay_tau)
                self.current_gas = self.base_gas + decay_elapsed * 0.05 + decay_excess  # Add a tiny baseline drift
                
                # End injection simulation when we are close enough to baseline or 5 time constants have passed
                if decay_elapsed > 5 * self.decay_tau or decay_excess < 1.0:
                    self.injection_active = False
                    self.current_gas = self.base_gas
        else:
            # Normal state: gas fluctuates around base_gas
            # Slow random walk + noise
            self.base_gas += random.uniform(-0.1, 0.1)
            self.base_gas = max(80.0, min(self.base_gas, 180.0))  # limit baseline drift
            self.current_gas = self.base_gas + random.uniform(-1.0, 1.0)
            
        return {
            "gas": round(self.current_gas, 1),
            "temp": round(temp, 1),
            "hum": round(hum, 1),
            "timestamp": round(current_time, 2)
        }
