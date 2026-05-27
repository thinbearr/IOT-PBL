import time
import math
from scientific_processor import ScientificProcessor

def test_decay_fitting():
    print("====================================================")
    print(" AeroSense Scientific Processor Math Verification")
    print("====================================================")
    
    # Initialize processor
    processor = ScientificProcessor(baseline_window_sec=100, decay_fit_duration_sec=60)
    
    # Target decay constant for test: 30 seconds
    target_tau = 30.0
    baseline = 120.0
    peak_excess = 300.0
    
    # 1. Warm-up / Establish baseline
    print("[1] Feeding stable baseline values...")
    base_time = 1710000000.0
    for i in range(15):
        t = base_time + i
        packet = {"gas": baseline, "temp": 20.0, "hum": 55.0, "timestamp": t}
        res = processor.process_packet(packet)
    
    print(f"    Current state: {processor.state}, Baseline: {processor.baseline}")
    assert abs(processor.baseline - baseline) < 1.0, "Baseline should stabilize around 120"

    # 2. Trigger gas injection
    print("[2] Feeding rising gas values to trigger injection...")
    injection_steps = [180.0, 300.0, 420.0]
    for i, gas in enumerate(injection_steps):
        t = base_time + 15 + i
        packet = {"gas": gas, "temp": 20.0, "hum": 55.0, "timestamp": t}
        res = processor.process_packet(packet)
        print(f"    t={t-base_time}s | Gas={gas} | State={res['state']} | Event={res['last_event']}")
        
    assert processor.state == "RISING", "Processor should enter RISING state"
    
    # 3. Peak and Decay
    print("[3] Feeding exponential decay data points...")
    decay_start = base_time + 15 + len(injection_steps)
    
    # We feed points every 1 second representing decay: C(t) = 120 + 300 * e^(-t/30)
    for step in range(40):
        t = decay_start + step
        elapsed = t - decay_start
        # Simulated gas reading
        gas_val = baseline + peak_excess * math.exp(-elapsed / target_tau)
        
        packet = {"gas": gas_val, "temp": 20.0, "hum": 55.0, "timestamp": t}
        res = processor.process_packet(packet)
        
        if step % 8 == 0 or step == 39:
            print(f"    t_decay={elapsed}s | Gas={gas_val:.1f} | State={res['state']} | Fit Tau={res['tau']}s | Score={res['stagnation_score']} | Vent={res['ventilation_quality']}")

    print("[4] Asserting results...")
    print(f"    Calculated Tau: {processor.tau:.2f} seconds (Target: {target_tau} seconds)")
    print(f"    Calculated ACH: {processor.ach:.2f} h^-1 (Air Changes Per Hour)")
    print(f"    Calculated Stagnation Score: {processor.stagnation_score:.1f} points")
    print(f"    Calculated Ventilation Quality: {processor.ventilation_quality}")

    # Check accuracy of fitted tau within 5%
    assert processor.tau is not None, "Tau estimation failed"
    percent_error = abs(processor.tau - target_tau) / target_tau * 100
    print(f"    Fitting Error: {percent_error:.2f}%")
    assert percent_error < 5.0, "Error in decay calculation is too high"
    
    print("\n[SUCCESS] Scientific algorithm successfully verified!")
    print("====================================================")

if __name__ == "__main__":
    test_decay_fitting()
