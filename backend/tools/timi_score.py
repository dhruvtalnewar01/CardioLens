"""TIMI Risk Score for UA/NSTEMI — Antman et al. 2000."""


def compute_timi_score(
    age_gte_65: bool, three_or_more_cad_risk_factors: bool,
    known_cad_gte_50pct_stenosis: bool, aspirin_use_7days: bool,
    two_or_more_angina_24hrs: bool, st_deviation_gte_05mm: bool,
    elevated_cardiac_markers: bool
) -> dict:
    """Returns TIMI score (0-7) and 14-day event risk."""
    score = sum([
        age_gte_65, three_or_more_cad_risk_factors,
        known_cad_gte_50pct_stenosis, aspirin_use_7days,
        two_or_more_angina_24hrs, st_deviation_gte_05mm,
        elevated_cardiac_markers
    ])

    event_rates = {0: 4.7, 1: 4.7, 2: 8.3, 3: 13.2, 4: 19.9, 5: 26.2, 6: 40.9, 7: 40.9}

    return {
        "score": score,
        "fourteen_day_event_rate_pct": event_rates[score],
        "risk_level": "low" if score <= 2 else ("intermediate" if score <= 4 else "high"),
    }
