"""Emoheal AI layer (rule-based placeholder).

This module is the single place where "AI" lives. Today it uses transparent,
rule-based checks and a damped linear forecast so the dashboard has realistic
behaviour from day one. To plug in a trained model later, keep the public
functions (`validate_readings`, `analyze`) and replace the internals, for
example by loading a scikit-learn / PyTorch model inside `forecast_density`.

A "reading" is one weekly sensor record:
    {"week": int, "strain_load": float (%), "bone_density": float (mg/cm3)}
"""

from statistics import mean

from data import STRAIN_WARNING_PCT, UNION_DENSITY_TARGET

MODEL_NAME = "emoheal-rules-v0 (placeholder)"
DENSITY_CEILING = 460        # mg/cm3 forecast never exceeds this
FORECAST_WEEKS = 6
FORECAST_DECAY = 0.92        # weekly gain shrinks as healing saturates
MIN_EXPECTED_GAIN = 4.0      # mg/cm3 per week once past the early phase
MAX_READINGS = 104           # two years of weekly data

_SEVERITY_ORDER = {"critical": 0, "warning": 1, "success": 2, "info": 3}


# --------------------------------------------------------------------------- #
# Input validation
# --------------------------------------------------------------------------- #
def validate_readings(raw):
    """Return a clean, week-sorted list of readings or raise ValueError."""
    if not isinstance(raw, list) or not raw:
        raise ValueError("Send at least one weekly reading in 'readings'.")
    if len(raw) > MAX_READINGS:
        raise ValueError(f"Send at most {MAX_READINGS} readings.")

    cleaned = []
    for position, row in enumerate(raw, start=1):
        try:
            week = int(row["week"])
            strain = float(row["strain_load"])
            density = float(row["bone_density"])
        except (KeyError, TypeError, ValueError):
            raise ValueError(
                f"Row {position} needs numeric week, strain_load and bone_density."
            )
        if week < 1:
            raise ValueError(f"Row {position}: week must be 1 or higher.")
        if not 0 <= strain <= 150:
            raise ValueError(f"Row {position}: strain_load must be between 0 and 150 (%).")
        if not 50 <= density <= 800:
            raise ValueError(f"Row {position}: bone_density must be between 50 and 800 mg/cm3.")
        cleaned.append({"week": week, "strain_load": strain, "bone_density": density})

    cleaned.sort(key=lambda r: r["week"])
    weeks = [r["week"] for r in cleaned]
    if len(set(weeks)) != len(weeks):
        raise ValueError("Each week can appear only once.")
    return cleaned


# --------------------------------------------------------------------------- #
# Forecast
# --------------------------------------------------------------------------- #
def _slope(values):
    """Least-squares slope per step. Returns 0.0 for fewer than two values."""
    count = len(values)
    if count < 2:
        return 0.0
    x_mean = (count - 1) / 2
    y_mean = mean(values)
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in enumerate(values))
    denominator = sum((x - x_mean) ** 2 for x in range(count))
    return numerator / denominator


def forecast_density(readings, horizon=FORECAST_WEEKS):
    """Project bone density forward from the most recent trend."""
    recent_slope = _slope([r["bone_density"] for r in readings[-4:]])
    density = readings[-1]["bone_density"]
    last_week = readings[-1]["week"]

    points = []
    for step in range(1, horizon + 1):
        density = min(DENSITY_CEILING, density + recent_slope * (FORECAST_DECAY ** step))
        points.append({"week": last_week + step, "bone_density": round(density, 1)})
    return points


def _estimate_union_week(readings, forecast):
    if readings[-1]["bone_density"] >= UNION_DENSITY_TARGET:
        return readings[-1]["week"]
    for point in forecast:
        if point["bone_density"] >= UNION_DENSITY_TARGET:
            return point["week"]
    return None


def _confidence(readings):
    """Heuristic only: more weekly readings means a more reliable trend."""
    return round(min(0.92, 0.40 + 0.05 * len(readings)), 2)


# --------------------------------------------------------------------------- #
# Insights
# --------------------------------------------------------------------------- #
def _insight(level, title, message):
    return {"level": level, "title": title, "message": message}


def _build_insights(readings, union_week):
    latest = readings[-1]
    count = len(readings)
    strains = [r["strain_load"] for r in readings]
    densities = [r["bone_density"] for r in readings]
    insights = []

    if count < 3:
        return [_insight(
            "info", "Building a baseline",
            "Fewer than three weekly readings so far. Trend analysis starts once week 3 is logged.",
        )]

    past_early_phase = latest["week"] >= 4

    # Plate strain checks
    if past_early_phase and latest["strain_load"] > STRAIN_WARNING_PCT:
        insights.append(_insight(
            "critical", "Abnormal bone stress",
            f"Plate strain is {latest['strain_load']:.0f}% of the design limit, above the "
            f"{STRAIN_WARNING_PCT}% alert level. Review weight-bearing restrictions and consider imaging.",
        ))
    elif past_early_phase and strains[-1] - strains[-3] >= 5:
        insights.append(_insight(
            "warning", "Strain is rising",
            f"Plate strain rose from {strains[-3]:.0f}% to {strains[-1]:.0f}% over two weeks. "
            "The bone should be taking more load, not less.",
        ))

    # Bone density checks
    recent_gain = _slope(densities[-3:])
    if recent_gain <= 0:
        insights.append(_insight(
            "critical", "Bone density is not increasing",
            f"Density has stalled or fallen over the last three readings ({densities[-3]:.0f} to "
            f"{densities[-1]:.0f} mg/cm3). Combined with plate load, this can point to delayed union.",
        ))
    elif past_early_phase and latest["week"] >= 6 and recent_gain < MIN_EXPECTED_GAIN:
        insights.append(_insight(
            "warning", "Healing is slower than expected",
            f"Density is gaining about {recent_gain:.1f} mg/cm3 per week, below the "
            f"{MIN_EXPECTED_GAIN:.0f} mg/cm3 per week expected at this stage.",
        ))

    # Positive findings
    has_concern = any(i["level"] in ("critical", "warning") for i in insights)
    if latest["bone_density"] >= UNION_DENSITY_TARGET and not has_concern:
        insights.append(_insight(
            "success", "Density at union threshold",
            f"Bone density ({latest['bone_density']:.0f} mg/cm3) has passed the "
            f"{UNION_DENSITY_TARGET} mg/cm3 union threshold and plate load is falling.",
        ))
    elif not has_concern and strains[-1] < strains[-3] and recent_gain > 0:
        eta = (
            f" Projected union around week {union_week}." if union_week else ""
        )
        insights.append(_insight(
            "success", "Healing is steady",
            f"Strain is falling and bone density is rising by about {recent_gain:.0f} mg/cm3 per week.{eta}",
        ))

    if not insights:
        insights.append(_insight(
            "info", "Within expected range",
            "No abnormal readings. Keep logging weekly data for a clearer trend.",
        ))

    insights.sort(key=lambda i: _SEVERITY_ORDER[i["level"]])
    return insights


def _overall_status(readings, insights):
    levels = {i["level"] for i in insights}
    if "critical" in levels:
        return "attention"
    if "warning" in levels:
        return "watch"
    if len(readings) < 4:
        return "early"
    return "on_track"


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def analyze(readings):
    """Analyse validated readings and return status, insights and a forecast."""
    forecast = forecast_density(readings)
    union_week = _estimate_union_week(readings, forecast)
    insights = _build_insights(readings, union_week)

    return {
        "status": _overall_status(readings, insights),
        "insights": insights,
        "forecast": {
            "points": forecast,
            "estimated_union_week": union_week,
            "confidence": _confidence(readings),
            "model": MODEL_NAME,
        },
    }
