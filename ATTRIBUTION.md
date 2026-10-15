# CardioLens 3D: Attribution and Licensing

## 1. Dataset
- **Name**: UCI Machine Learning Repository Dataset ID 411: "extention of Z-Alizadeh sani dataset"
- **DOI**: 10.24432/C5461K
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Creators**: Roohallah Alizadehsani, Jafar Habibi, Mohammad Javad Hosseini, Zahra Alizadeh Sani, et al.
- **Citation**: Alizadehsani, R., et al. (2020). "A database for using machine learning and data mining techniques for coronary artery disease diagnosis." Expert Systems.
- **Cohort**: 303 angiography-referred patients from Tehran Heart Center.

## 2. Anatomical Models and Geometry
- **Procedural Coronary Geometry (Mode C)**:
  - Custom procedural Catmull-Rom centerline splines for Left Anterior Descending (LAD), Left Circumflex (LCX), and Right Coronary Artery (RCA) with diagonal (D1, D2), obtuse marginal (OM), and posterior descending (PDA) branches.
  - Zero external mesh download dependency, zero commercial license restrictions.
- **Color Palette**:
  - ColorBrewer RdYlBu (7-class diverging palette, color-vision-deficiency safe).
  - Designed by Cynthia Brewer, Mark Harrower, and The Pennsylvania State University under Apache-2.0 / CC-style license.

## 3. Machine Learning and Software Libraries
- **Frontend Core**: Next.js 16.2.1 (MIT), React 19.2.4 (MIT), Tailwind CSS 4 (MIT).
- **3D Graphics**: Three.js (MIT), React Three Fiber (MIT), React Three Drei (MIT).
- **Report Generation**: jsPDF (MIT).
- **Machine Learning**: scikit-learn (BSD 3-Clause), LightGBM (MIT), NumPy (BSD 3-Clause), Pandas (BSD 3-Clause).
