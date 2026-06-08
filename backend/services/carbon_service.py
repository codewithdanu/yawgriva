"""
Carbon Footprint Service — Feature 6.

Calculates CO₂ emissions for each delivery batch based on:
- Distance traveled (km)
- Vehicle type and its emission factor
- Quantity transported (kg)

Emission factors based on IPCC Transport Guidelines 2023.
"""

from dataclasses import dataclass

# CO₂ emission factors in kg per km per metric ton of cargo
EMISSION_FACTORS: dict[str, float] = {
    "motor": 0.11,
    "pickup": 0.18,
    "mobil_boks": 0.22,
    "truk_kecil": 0.28,
    "truk_besar": 0.35,
    "default": 0.22,
}

# Trees planted equivalent: 1 tree absorbs ~21.77 kg CO₂/year (IPCC estimate)
TREE_ABSORPTION_KG_PER_YEAR = 21.77

# Baseline assumption: non-optimized route is 30% longer
BASELINE_DISTANCE_FACTOR = 1.3


@dataclass
class CarbonResult:
    actual_kg_co2: float
    baseline_kg_co2: float
    saving_kg_co2: float
    saving_percent: float
    equivalent_trees: float
    distance_km: float
    vehicle_type: str
    quantity_kg: float


def calculate_carbon_footprint(
    distance_km: float,
    vehicle_type: str,
    quantity_kg: float,
) -> CarbonResult:
    """
    Calculate CO₂ footprint for a delivery.

    Args:
        distance_km: total distance traveled
        vehicle_type: key from EMISSION_FACTORS dict
        quantity_kg: weight of cargo in kg

    Returns:
        CarbonResult with actual emission, baseline, and savings
    """
    vehicle_key = vehicle_type.lower().replace(" ", "_").replace("-", "_")
    factor = EMISSION_FACTORS.get(vehicle_key, EMISSION_FACTORS["default"])

    quantity_ton = quantity_kg / 1000
    actual_emission = distance_km * factor * quantity_ton

    # Baseline: route 30% longer (non-optimized)
    baseline_emission = actual_emission * BASELINE_DISTANCE_FACTOR
    saving = baseline_emission - actual_emission
    saving_percent = (saving / baseline_emission) * 100 if baseline_emission > 0 else 0.0
    equivalent_trees = saving / TREE_ABSORPTION_KG_PER_YEAR

    return CarbonResult(
        actual_kg_co2=round(actual_emission, 2),
        baseline_kg_co2=round(baseline_emission, 2),
        saving_kg_co2=round(saving, 2),
        saving_percent=round(saving_percent, 1),
        equivalent_trees=round(equivalent_trees, 3),
        distance_km=round(distance_km, 2),
        vehicle_type=vehicle_type,
        quantity_kg=round(quantity_kg, 2),
    )


def get_vehicle_options() -> list[dict]:
    """Return list of vehicle options for frontend dropdowns."""
    return [
        {"value": "motor", "label": "Motor"},
        {"value": "pickup", "label": "Pickup / L300"},
        {"value": "mobil_boks", "label": "Mobil Boks"},
        {"value": "truk_kecil", "label": "Truk Kecil"},
        {"value": "truk_besar", "label": "Truk Besar"},
    ]
