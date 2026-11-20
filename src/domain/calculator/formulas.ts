export type ProfessionCategory =
  | 'Finance & Accounting'
  | 'Architecture & Construction'
  | 'Engineering & Physics'
  | 'Healthcare & Nursing'
  | 'Data & Statistics'
  | 'Software & Cloud';

export interface MathFormula {
  readonly id: string;
  readonly profession: ProfessionCategory;
  readonly purpose: string;
  readonly name: string;
  readonly symbolic: string;
  readonly sampleExpression: string;
  readonly note: string;
}

export const PROFESSION_CATEGORIES: readonly ProfessionCategory[] = [
  'Finance & Accounting',
  'Architecture & Construction',
  'Engineering & Physics',
  'Healthcare & Nursing',
  'Data & Statistics',
  'Software & Cloud',
];

export const MATH_FORMULAS: readonly MathFormula[] = [
  // Finance & Accounting
  {
    id: 'fin-compound',
    profession: 'Finance & Accounting',
    purpose: 'Investment Growth',
    name: 'Compound Interest',
    symbolic: 'P × (1 + r)^n',
    sampleExpression: '1000 * (1 + 0.05)^10',
    note: 'Principal P, rate r, periods n',
  },
  {
    id: 'fin-pct-change',
    profession: 'Finance & Accounting',
    purpose: 'Performance Reporting',
    name: 'Percentage Change',
    symbolic: '(new − old) ÷ old × 100',
    sampleExpression: '(125 - 100) / 100 * 100',
    note: 'Relative growth or decline %',
  },
  {
    id: 'fin-markup',
    profession: 'Finance & Accounting',
    purpose: 'Pricing & Retail',
    name: 'Price with Markup',
    symbolic: 'cost × (1 + margin)',
    sampleExpression: '80 * (1 + 0.25)',
    note: 'Selling price from unit cost',
  },
  {
    id: 'fin-rule72',
    profession: 'Finance & Accounting',
    purpose: 'Wealth Planning',
    name: 'Rule of 72',
    symbolic: '72 ÷ rate',
    sampleExpression: '72 / 6',
    note: 'Estimated years to double',
  },

  // Architecture & Construction
  {
    id: 'arch-area',
    profession: 'Architecture & Construction',
    purpose: 'Flooring & Materials',
    name: 'Rectangular Area',
    symbolic: 'length × width',
    sampleExpression: '12.5 * 8.4',
    note: 'Surface coverage in sq units',
  },
  {
    id: 'arch-diagonal',
    profession: 'Architecture & Construction',
    purpose: 'Structural Layout',
    name: 'Pythagorean Diagonal',
    symbolic: '√(a² + b²)',
    sampleExpression: 'sqrt(3^2 + 4^2)',
    note: 'Check square corners or brace length',
  },
  {
    id: 'arch-cylinder',
    profession: 'Architecture & Construction',
    purpose: 'Concrete & Excavation',
    name: 'Cylinder Volume',
    symbolic: 'π × r² × h',
    sampleExpression: 'pi * 1.5^2 * 4',
    note: 'Column or tank volume',
  },
  {
    id: 'arch-pitch',
    profession: 'Architecture & Construction',
    purpose: 'Stairs & Ramps',
    name: 'Slope / Pitch %',
    symbolic: 'rise ÷ run × 100',
    sampleExpression: '1.2 / 15 * 100',
    note: 'Grade percentage from rise and run',
  },

  // Engineering & Physics
  {
    id: 'eng-ohms-power',
    profession: 'Engineering & Physics',
    purpose: 'Electrical Systems',
    name: 'Electrical Power',
    symbolic: 'V² ÷ R',
    sampleExpression: '12^2 / 4',
    note: 'Voltage V, resistance R (Ω)',
  },
  {
    id: 'eng-kinetic',
    profession: 'Engineering & Physics',
    purpose: 'Motion & Mechanics',
    name: 'Kinetic Energy',
    symbolic: '0.5 × m × v²',
    sampleExpression: '0.5 * 10 * 4^2',
    note: 'Mass m (kg), velocity v (m/s)',
  },
  {
    id: 'eng-gravity',
    profession: 'Engineering & Physics',
    purpose: 'Structural Load',
    name: 'Weight Force',
    symbolic: 'm × 9.81',
    sampleExpression: '70 * 9.81',
    note: 'Mass m (kg) under Earth g',
  },
  {
    id: 'eng-wave',
    profession: 'Engineering & Physics',
    purpose: 'Signal & RF',
    name: 'Wave Frequency',
    symbolic: 'c ÷ λ',
    sampleExpression: '300000000 / 0.5',
    note: 'Speed c divided by wavelength λ',
  },

  // Healthcare & Nursing
  {
    id: 'med-bmi',
    profession: 'Healthcare & Nursing',
    purpose: 'Patient Assessment',
    name: 'Body Mass Index (BMI)',
    symbolic: 'weight ÷ height²',
    sampleExpression: '72 / 1.75^2',
    note: 'Weight (kg) and height (m)',
  },
  {
    id: 'med-iv',
    profession: 'Healthcare & Nursing',
    purpose: 'IV Therapy',
    name: 'IV Drip Rate (gtt/min)',
    symbolic: '(volume × dropFactor) ÷ minutes',
    sampleExpression: '(500 * 20) / 120',
    note: 'Volume (mL), drop factor, duration',
  },
  {
    id: 'med-dose',
    profession: 'Healthcare & Nursing',
    purpose: 'Dosage Calculation',
    name: 'Weight-Based Dose',
    symbolic: 'weightKg × dosePerKg',
    sampleExpression: '68 * 15',
    note: 'Total mg from patient weight',
  },
  {
    id: 'med-map',
    profession: 'Healthcare & Nursing',
    purpose: 'Cardiology',
    name: 'Mean Arterial Pressure',
    symbolic: '(SBP + 2 × DBP) ÷ 3',
    sampleExpression: '(120 + 2 * 80) / 3',
    note: 'Systolic and diastolic BP',
  },

  // Data & Statistics
  {
    id: 'stat-mean',
    profession: 'Data & Statistics',
    purpose: 'Summary Metrics',
    name: 'Arithmetic Mean',
    symbolic: '(a + b + c) ÷ n',
    sampleExpression: '(12 + 18 + 24) / 3',
    note: 'Average of sample values',
  },
  {
    id: 'stat-se',
    profession: 'Data & Statistics',
    purpose: 'Sampling Precision',
    name: 'Standard Error',
    symbolic: 's ÷ √n',
    sampleExpression: '15 / sqrt(25)',
    note: 'Std dev s over √sample size n',
  },
  {
    id: 'stat-exp-growth',
    profession: 'Data & Statistics',
    purpose: 'Forecasting',
    name: 'Continuous Growth',
    symbolic: 'a × e^(r × t)',
    sampleExpression: '100 * e^(0.08 * 5)',
    note: 'Initial a, rate r, time t',
  },
  {
    id: 'stat-pct-err',
    profession: 'Data & Statistics',
    purpose: 'Model Evaluation',
    name: 'Percentage Error',
    symbolic: 'abs(est − actual) ÷ actual × 100',
    sampleExpression: 'abs(94 - 100) / 100 * 100',
    note: 'Forecast accuracy error %',
  },

  // Software & Cloud
  {
    id: 'sw-rpm',
    profession: 'Software & Cloud',
    purpose: 'Capacity Planning',
    name: 'Requests per Minute',
    symbolic: 'rps × 60',
    sampleExpression: '450 * 60',
    note: 'Convert RPS to RPM',
  },
  {
    id: 'sw-gib',
    profession: 'Software & Cloud',
    purpose: 'Storage Sizing',
    name: 'GiB to MiB',
    symbolic: 'GiB × 1024',
    sampleExpression: '16 * 1024',
    note: 'Binary memory conversion',
  },
  {
    id: 'sw-sla',
    profession: 'Software & Cloud',
    purpose: 'Reliability / SRE',
    name: 'Annual Downtime (min)',
    symbolic: '525600 × (1 − SLA)',
    sampleExpression: '525600 * (1 - 0.9995)',
    note: 'Allowed downtime for SLA',
  },
  {
    id: 'sw-transfer',
    profession: 'Software & Cloud',
    purpose: 'Network Transfer',
    name: 'Transfer Time (sec)',
    symbolic: 'fileMB × 8 ÷ Mbps',
    sampleExpression: '250 * 8 / 100',
    note: 'File size (MB) over link speed',
  },
];
