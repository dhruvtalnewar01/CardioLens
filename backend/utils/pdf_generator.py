"""PDF report generator for CHD clinical reports using reportlab."""
from io import BytesIO
from datetime import datetime, timezone, timedelta

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


def generate_report_pdf(analysis_result: dict, patient_info: dict) -> bytes:
    """Generate a comprehensive clinical report PDF."""
    if not HAS_REPORTLAB:
        raise ImportError("reportlab required: pip install reportlab")

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18*mm, bottomMargin=18*mm, leftMargin=16*mm, rightMargin=16*mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('ReportTitle', parent=styles['Title'], fontSize=18, textColor=HexColor('#00BCD4'), spaceAfter=3*mm, fontName='Helvetica-Bold')
    heading = ParagraphStyle('SectionHeading', parent=styles['Heading2'], fontSize=12, textColor=HexColor('#FF5722'), spaceBefore=5*mm, spaceAfter=2*mm, fontName='Helvetica-Bold')
    sub_heading = ParagraphStyle('SubHead', parent=styles['Heading3'], fontSize=10, textColor=HexColor('#2196F3'), spaceBefore=3*mm, spaceAfter=1.5*mm)
    body = ParagraphStyle('Body', parent=styles['Normal'], fontSize=9, leading=13, spaceAfter=1.5*mm)
    small = ParagraphStyle('Small', parent=styles['Normal'], fontSize=7.5, leading=10, textColor=HexColor('#666666'))
    disclaimer = ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=7, leading=9, textColor=HexColor('#999999'), spaceBefore=6*mm)

    elements = []

    # ── Title ──
    elements.append(Paragraph("CHD Predictor AI — Comprehensive Clinical Report", title_style))
    ist = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(ist)
    elements.append(Paragraph(f"Generated: {now_ist.strftime('%Y-%m-%d %H:%M IST')} | Report ID: {now_ist.strftime('%Y%m%d%H%M%S')}", small))
    elements.append(HRFlowable(width="100%", thickness=1, color=HexColor('#00BCD4'), spaceBefore=2*mm, spaceAfter=4*mm))

    # ── Patient Demographics ──
    elements.append(Paragraph("1. Patient Demographics", heading))
    name = f"{patient_info.get('firstName', patient_info.get('first_name', 'N/A'))} {patient_info.get('lastName', patient_info.get('last_name', ''))}".strip()
    height = patient_info.get('height', patient_info.get('height_cm', 'N/A'))
    weight = patient_info.get('weight', patient_info.get('weight_kg', 'N/A'))
    bmi = patient_info.get('bmi', '')
    if not bmi and height and weight:
        try:
            bmi = round(float(weight) / ((float(height)/100)**2), 1)
        except:
            bmi = "N/A"

    demo_data = [
        ["Name", str(name), "DOB", str(patient_info.get('dob', 'N/A'))],
        ["Sex", str(patient_info.get('sex', 'N/A')).capitalize(), "Ethnicity", str(patient_info.get('ethnicity', 'N/A'))],
        ["Height", f"{height} cm", "Weight", f"{weight} kg"],
        ["BMI", str(bmi), "Smoking", str(patient_info.get('smoking', patient_info.get('smoking_status', 'N/A'))).capitalize()],
        ["Diabetes", str(patient_info.get('diabetes', patient_info.get('diabetes_type', 'N/A'))).capitalize(),
         "Hypertension", "Yes" if patient_info.get('hypertension') else "No"],
        ["Family CHD History", "Yes" if patient_info.get('familyHistory', patient_info.get('family_chd_history')) else "No", "", ""],
    ]
    t = Table(demo_data, colWidths=[85, 115, 85, 115])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 8), ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'), ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0,0), (0,-1), HexColor('#333333')), ('TEXTCOLOR', (2,0), (2,-1), HexColor('#333333')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4), ('TOPPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#DDDDDD')),
    ]))
    elements.append(t)

    # ── Biomarker Results ──
    elements.append(Paragraph("2. Biomarker Panel Analysis", heading))
    bio = analysis_result.get('biomarker_analysis') or {}
    # Build biomarker table from input data
    bio_fields = {
        'ldl_cholesterol': ('LDL Cholesterol', 'mg/dL', '< 100'), 'hdl_cholesterol': ('HDL Cholesterol', 'mg/dL', '> 60'),
        'total_cholesterol': ('Total Cholesterol', 'mg/dL', '< 200'), 'triglycerides': ('Triglycerides', 'mg/dL', '< 150'),
        'crp_hs': ('hs-CRP', 'mg/L', '< 1.0'), 'troponin_i': ('Troponin I', 'ng/mL', '< 0.04'),
        'hba1c': ('HbA1c', '%', '< 5.7'), 'fasting_glucose': ('Fasting Glucose', 'mg/dL', '< 100'),
    }
    form_map = {'ldl_cholesterol': 'ldl', 'hdl_cholesterol': 'hdl', 'total_cholesterol': 'totalChol', 'triglycerides': 'triglycerides',
                'crp_hs': 'crpHs', 'troponin_i': 'troponinI', 'hba1c': 'hba1c', 'fasting_glucose': 'fastingGlucose'}

    bio_rows = [['Biomarker', 'Value', 'Unit', 'Reference Range']]
    for key, (name_str, unit, ref) in bio_fields.items():
        form_key = form_map.get(key, '')
        val = patient_info.get(form_key, '')
        if val:
            bio_rows.append([name_str, str(val), unit, ref])

    if len(bio_rows) > 1:
        t2 = Table(bio_rows, colWidths=[120, 60, 50, 100])
        t2.setStyle(TableStyle([
            ('FONTSIZE', (0,0), (-1,-1), 8), ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BACKGROUND', (0,0), (-1,0), HexColor('#F5F5F5')),
            ('GRID', (0,0), (-1,-1), 0.5, HexColor('#DDDDDD')),
            ('TOPPADDING', (0,0), (-1,-1), 3), ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        elements.append(t2)

    # AI Biomarker Summary
    if bio:
        grade = bio.get('lipid_profile_grade', '')
        inflam = bio.get('inflammatory_risk_tier', '')
        metab = bio.get('metabolic_syndrome')
        summary_parts = []
        if grade: summary_parts.append(f"Lipid Grade: {grade.upper()}")
        if inflam: summary_parts.append(f"Inflammatory Risk: {inflam.upper()}")
        if metab is not None: summary_parts.append(f"Metabolic Syndrome: {'Detected' if metab else 'Not Detected'}")
        if summary_parts:
            elements.append(Paragraph(f"<b>AI Assessment:</b> {' | '.join(summary_parts)}", body))
        narrative = bio.get('narrative', '')
        if narrative:
            elements.append(Paragraph(str(narrative), body))

    # ── Clinical Risk Scores ──
    elements.append(Paragraph("3. Clinical Risk Scores", heading))
    scores = analysis_result.get('clinical_scores') or {}
    score_labels = {
        'framingham_10yr_risk': ('Framingham 10-Year CVD Risk', '%'),
        'pooled_cohort_10yr_risk': ('Pooled Cohort Equations (ASCVD)', '%'),
        'grace_score': ('GRACE ACS Score', 'points'),
        'timi_score': ('TIMI Score', 'points'),
        'reynolds_risk': ('Reynolds Risk Score', '%'),
        'score2_risk': ('SCORE2 (ESC)', '%'),
    }
    score_rows = [['Risk Score', 'Value', 'Interpretation']]
    for key, (label, unit) in score_labels.items():
        val = scores.get(key)
        if val is not None:
            interpretation = ""
            if unit == '%':
                fval = float(val) if isinstance(val, (int, float)) else 0
                if fval >= 20: interpretation = "HIGH RISK"
                elif fval >= 7.5: interpretation = "INTERMEDIATE"
                else: interpretation = "LOW RISK"
            elif key == 'grace_score':
                interpretation = "HIGH" if (isinstance(val, (int, float)) and val >= 140) else "MODERATE" if (isinstance(val, (int, float)) and val >= 100) else "LOW"
            score_rows.append([label, f"{val}{unit if unit=='%' else ' '+unit}", interpretation])

    if len(score_rows) > 1:
        t3 = Table(score_rows, colWidths=[180, 80, 100])
        t3.setStyle(TableStyle([
            ('FONTSIZE', (0,0), (-1,-1), 8), ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BACKGROUND', (0,0), (-1,0), HexColor('#F5F5F5')),
            ('GRID', (0,0), (-1,-1), 0.5, HexColor('#DDDDDD')),
            ('TOPPADDING', (0,0), (-1,-1), 3), ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        elements.append(t3)

    # ── AI Risk Synthesis ──
    risk = analysis_result.get('risk_assessment') or {}
    if risk:
        elements.append(Paragraph("4. AI Risk Synthesis", heading))
        tier = risk.get('overall_risk_tier', 'N/A').upper().replace('_', ' ')
        composite = risk.get('composite_ml_risk_score', 'N/A')
        ci_lo = risk.get('confidence_interval_lower', '')
        ci_hi = risk.get('confidence_interval_upper', '')
        mace = risk.get('ten_year_mace_probability', '')

        elements.append(Paragraph(f"<b>Overall Risk Tier:</b> {tier} &nbsp;&nbsp; <b>Composite Score:</b> {composite}/100 &nbsp;&nbsp; <b>95% CI:</b> {ci_lo}–{ci_hi}", body))
        if mace: elements.append(Paragraph(f"<b>10-Year MACE Probability:</b> {mace}%", body))

        if risk.get('modifiable_risk_drivers'):
            elements.append(Paragraph("Modifiable Risk Drivers", sub_heading))
            for d in risk['modifiable_risk_drivers'][:5]:
                if isinstance(d, dict):
                    elements.append(Paragraph(f"• <b>{d.get('factor','')}</b>: Current {d.get('current_value','')} → Target {d.get('target_value','')} (Impact: {d.get('impact_score','')}/10)", body))

        reasoning = risk.get('clinical_reasoning', '')
        if reasoning:
            elements.append(Paragraph("Clinical Reasoning", sub_heading))
            elements.append(Paragraph(str(reasoning), body))

    # ── Intervention Plan ──
    intv = analysis_result.get('intervention_plan') or {}
    if intv:
        elements.append(PageBreak())
        elements.append(Paragraph("5. Comprehensive Intervention Plan", heading))

        # Medications
        meds = intv.get('pharmacological_recommendations') or intv.get('pharmacological') or []
        if meds:
            elements.append(Paragraph("5.1 Pharmacological Recommendations", sub_heading))
            med_rows = [['Drug', 'Dose', 'Frequency', 'Monitoring', 'Evidence']]
            for m in (meds if isinstance(meds, list) else []):
                if isinstance(m, dict):
                    med_rows.append([
                        str(m.get('drug', ''))[:30], str(m.get('dose', '')),
                        str(m.get('frequency', '')), str(m.get('monitoring', ''))[:35],
                        str(m.get('evidence_grade', ''))
                    ])
            if len(med_rows) > 1:
                tm = Table(med_rows, colWidths=[80, 60, 55, 100, 40])
                tm.setStyle(TableStyle([
                    ('FONTSIZE', (0,0), (-1,-1), 7), ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                    ('BACKGROUND', (0,0), (-1,0), HexColor('#E8F5E9')),
                    ('GRID', (0,0), (-1,-1), 0.5, HexColor('#DDDDDD')),
                    ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                ]))
                elements.append(tm)

        # Lifestyle
        lifestyle = intv.get('lifestyle_modifications') or []
        if lifestyle:
            elements.append(Paragraph("5.2 Lifestyle Modifications", sub_heading))
            if isinstance(lifestyle, list):
                for item in lifestyle:
                    if isinstance(item, dict):
                        elements.append(Paragraph(f"• <b>{item.get('recommendation','')}</b>: {item.get('description','')}", body))
                    else:
                        elements.append(Paragraph(f"• {item}", body))
            elif isinstance(lifestyle, dict):
                for k, v in lifestyle.items():
                    elements.append(Paragraph(f"• <b>{k.replace('_',' ').title()}</b>: {v}", body))

        # Exercise Prescription
        exercise = intv.get('exercise_prescription') or {}
        if exercise:
            elements.append(Paragraph("5.3 Exercise Prescription (FITT)", sub_heading))
            if isinstance(exercise, dict):
                for k, v in exercise.items():
                    elements.append(Paragraph(f"• <b>{k.replace('_',' ').title()}</b>: {v}", body))

        # Dietary Plan
        diet = intv.get('dietary_plan') or intv.get('diet') or []
        if diet:
            elements.append(Paragraph("5.4 Dietary Recommendations", sub_heading))
            if isinstance(diet, list):
                for item in diet:
                    if isinstance(item, dict):
                        elements.append(Paragraph(f"• <b>{item.get('recommendation','')}</b>: {item.get('details','')}", body))
                    else:
                        elements.append(Paragraph(f"• {item}", body))

        # Monitoring Schedule
        monitoring = intv.get('monitoring_schedule') or []
        if monitoring:
            elements.append(Paragraph("5.5 Monitoring Schedule", sub_heading))
            if isinstance(monitoring, list):
                mon_rows = [['Test', 'Frequency', 'Target']]
                for m in monitoring:
                    if isinstance(m, dict):
                        mon_rows.append([str(m.get('test','')), str(m.get('frequency','')), str(m.get('target',''))])
                if len(mon_rows) > 1:
                    tmon = Table(mon_rows, colWidths=[140, 100, 120])
                    tmon.setStyle(TableStyle([
                        ('FONTSIZE', (0,0), (-1,-1), 8), ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                        ('BACKGROUND', (0,0), (-1,0), HexColor('#F5F5F5')),
                        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#DDDDDD')),
                        ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                    ]))
                    elements.append(tmon)

        # Referrals
        referrals = intv.get('procedural_referrals') or []
        if referrals and isinstance(referrals, list):
            elements.append(Paragraph("5.6 Procedural Referrals", sub_heading))
            for r in referrals:
                if isinstance(r, dict):
                    elements.append(Paragraph(f"• <b>{r.get('procedure','')}</b> — {r.get('indication','')} (Urgency: {r.get('urgency','')})", body))

        # Guideline Citations
        citations = intv.get('guideline_citations') or []
        if citations and isinstance(citations, list):
            elements.append(Paragraph("5.7 Guideline Citations", sub_heading))
            for c in citations:
                if isinstance(c, dict):
                    elements.append(Paragraph(f"• [{c.get('evidence_level','')}] <b>{c.get('guideline','')}</b>: {c.get('recommendation','')}", body))

    # ── Clinical Report Narrative ──
    report = analysis_result.get('clinical_report') or {}
    if report:
        elements.append(Paragraph("6. Clinical Report Narrative", heading))
        narrative_sections = [
            ('executive_summary', 'Executive Summary'), ('clinical_background', 'Clinical Background'),
            ('biomarker_narrative', 'Biomarker Analysis'), ('risk_assessment_narrative', 'Risk Assessment'),
            ('intervention_narrative', 'Treatment & Interventions'), ('recommendations', 'Prioritized Recommendations'),
            ('monitoring_narrative', 'Follow-Up Plan'),
        ]
        for key, label in narrative_sections:
            val = report.get(key)
            if val:
                elements.append(Paragraph(label, sub_heading))
                elements.append(Paragraph(str(val), body))

    # ── Disclaimer ──
    elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#CCCCCC'), spaceBefore=5*mm, spaceAfter=2*mm))
    elements.append(Paragraph(
        "DISCLAIMER: This AI-assisted analysis is intended to support clinical decision-making and does not "
        "constitute a medical diagnosis. All risk assessments, recommendations, and reports require review, "
        "clinical correlation, and approval by a licensed physician before any treatment decisions are made. "
        "This tool has not been approved by the FDA or any regulatory authority as a standalone diagnostic device.",
        disclaimer
    ))
    ist = timezone(timedelta(hours=5, minutes=30))
    elements.append(Paragraph(f"CHD Predictor AI · v2.0 · Report generated {datetime.now(ist).strftime('%Y-%m-%d %H:%M IST')}", disclaimer))

    doc.build(elements)
    return buf.getvalue()
