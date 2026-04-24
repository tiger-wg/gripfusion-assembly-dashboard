import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'

type NavItem =
  | 'dashboard'
  | 'assembly'
  | 'testing'
  | 'bom'
  | 'admin'
  | 'versions'
  | 'logs'
  | 'profile'

type Step = {
  id: string
  phase: string
  title: string
  instruction: string
  substeps: { id: string; title: string }[]
  tools: string[]
  materials: string[]
  critical: string
  versionNote: string
  fmea: string
  isPublished: boolean
}
type ProcessImportRow = {
  stepNumber: number
  stepId: string
  stepTitle: string
  stepInstruction: string
  substepId: string
  substepTitle: string
  substepOrder: number
  published: boolean
}
type BomRow = {
  itemNo: string
  partName: string
  drawingNumber: string
  jviPartNo: string
  customerPartNo: string
  qty: string
  material: string
  supplier: string
  mfgProcess: string
  color: string
  finish: string
  dimensions: string
}

type ViewMode = 'technician' | 'workflow'
type UserProfile = {
  id: string
  fullName: string
  displayName: string
  role: string
  username: string
  avatarUrl: string
  email: string
}
type ManagedAccount = {
  id: string
  name: string
  username: string
  email: string
  role: 'ADMIN' | 'TECHNICIAN'
  isActive: boolean
}
type IssueRow = {
  type: 'ERROR' | 'WARNING' | 'RESOLVED' | 'INFO'
  id: string
  description: string
  step: string
  flaggedBy: string
  time: string
  status: 'Open' | 'Resolved'
  source: 'Technician' | 'System'
}

const navItemsByView: Record<ViewMode, { id: NavItem; label: string }[]> = {
  workflow: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'bom', label: 'Bill of Materials' },
    { id: 'assembly', label: 'Manual Edits' },
    { id: 'testing', label: 'Flags & Issues' },
    { id: 'logs', label: 'Data & Logs' },
    { id: 'admin', label: 'GripFusion Admin' },
  ],
  technician: [
    { id: 'assembly', label: 'My Work' },
    { id: 'testing', label: 'Testing & QA' },
    { id: 'versions', label: 'Flags & Issues' },
    { id: 'profile', label: 'My Profile' },
    { id: 'logs', label: 'My Log' },
  ],
}

const initialSteps: Step[] = [
  {
    id: 'S01',
    phase: 'Setup',
    title: 'Pre-Assembly Setup',
    instruction:
      'Confirm setup readiness, materials, and calibrated tools before assembly.',
    substeps: [
      { id: 'S01.1', title: 'Assembly Reference Check' },
      { id: 'S01.2', title: 'Materials Verification' },
      { id: 'S01.3', title: 'Tool Readiness Check' },
    ],
    tools: ['Ruler', 'Measuring Tape', 'Vice/Clamp', 'Hot Glue Gun Arrow Low Temp (GT80DT)'],
    materials: ['Super Glue (3M PR100)', 'Hot Melt Glue Low Temp (AP 10-4)', 'Isopropyl Alcohol (99%)', '3M Adhesion Promoter (3M97)', 'Part Tracking Checklist'],
    critical: 'Verify workstation readiness and required tools before any assembly action.',
    versionNote: 'Cleaned from GripFusion Process Steps workbook.',
    fmea: 'Missing setup checks creates traceability and build quality risk downstream.',
    isPublished: true,
  },
  {
    id: 'S02',
    phase: 'Assembly',
    title: 'Petal Assembly',
    instruction:
      'Align, clamp, and validate petal installation before core integration.',
    substeps: [
      { id: 'S02.1', title: 'Petal Alignment & Insertion' },
      { id: 'S02.2', title: 'Petal Clamping' },
      { id: 'S02.3', title: 'Petal Fit Verification' },
      { id: 'S02.4', title: 'Charging Coil Check' },
      { id: 'S02.5', title: 'App Launch & Scan' },
      { id: 'S02.6', title: 'Device Selection' },
      { id: 'S02.7', title: 'Connect & Start Test' },
      { id: 'S02.8', title: 'Sensor Response Check' },
    ],
    tools: ['Alignment Fixture', 'Connector Clamp Set', 'Wireless Charger'],
    materials: ['Petal Set', 'Connector Board'],
    critical: 'Petal orientation and clamp sequence must be correct before proceeding.',
    versionNote: 'Cleaned from GripFusion Process Steps workbook.',
    fmea: 'Incorrect petal alignment can invalidate sensor behavior and force rework.',
    isPublished: true,
  },
  {
    id: 'S03',
    phase: 'Assembly',
    title: 'Electronics & Core Assembly',
    instruction:
      'Prepare electronics package, secure battery and coil, and close hemispheres with proper cure handling.',
    substeps: [
      { id: 'S03.1', title: 'Electronics Prep' },
      { id: 'S03.2', title: 'Battery Mounting' },
      { id: 'S03.3', title: 'Coil Placement' },
      { id: 'S03.4', title: 'Wire Routing Check' },
      { id: 'S03.5', title: 'Wire Securing' },
      { id: 'S03.6', title: 'Top Hemisphere Assembly' },
      { id: 'S03.7', title: 'Opposite Side Assembly' },
      { id: 'S03.8', title: 'Clamp & Cure Hold' },
    ],
    tools: ['Glue Applicator', 'Non-Metal Probe', 'Clamp Fixture'],
    materials: ['Battery Housing', 'Coil Assembly', 'Top Hemisphere Components'],
    critical: 'Coil wire isolation and adhesive cure sequence are mandatory quality gates.',
    versionNote: 'Cleaned from GripFusion Process Steps workbook.',
    fmea: 'Improper wire routing or incomplete cure can cause intermittent electrical faults.',
    isPublished: true,
  },
  {
    id: 'S04',
    phase: 'Assembly',
    title: 'Sensor Petal Wrapping',
    instruction:
      'Prepare surfaces and apply petal film with strict alignment and pressure sequence.',
    substeps: [
      { id: 'S04.1', title: 'Surface Prep & Cleaning' },
      { id: 'S04.2', title: 'Backing Removal' },
      { id: 'S04.3', title: 'Centerline Application' },
      { id: 'S04.4', title: 'Alternating Side Wrap' },
      { id: 'S04.5', title: 'Final Wrap Inspection' },
    ],
    tools: ['Lint-Free Wipes', 'Adhesion Prep Kit', 'Pressure Roller'],
    materials: ['Sensor Petal Film', 'Isopropyl Alcohol', 'Adhesion Promoter'],
    critical: 'Petal film cannot be peeled and reapplied once adhered.',
    versionNote: 'Cleaned from GripFusion Process Steps workbook.',
    fmea: 'Wrinkles, misalignment, or film tearing leads to failed test validation.',
    isPublished: true,
  },
  {
    id: 'S05',
    phase: 'QA',
    title: 'Testing & Validation',
    instruction:
      'Execute final validation workflow and confirm sensor behavior under test.',
    substeps: [
      { id: 'S05.1', title: 'Pre-Test Readiness Check' },
      { id: 'S05.2', title: 'Device Scan' },
      { id: 'S05.3', title: 'Device Connect' },
      { id: 'S05.4', title: 'Sensor Test Start' },
      { id: 'S05.5', title: 'Pixel Response Validation' },
      { id: 'S05.6', title: 'Result Logging & Release' },
    ],
    tools: ['ForceBall App', 'Sensor Test Station'],
    materials: ['QA Checklist', 'Labels'],
    critical: 'All test thresholds must pass before release.',
    versionNote: 'Cleaned from GripFusion Process Steps workbook.',
    fmea: 'Missed validation allows latent defects to ship.',
    isPublished: true,
  },
]

const importedStepMetaById: Record<string, Pick<Step, 'phase' | 'tools' | 'materials' | 'critical' | 'versionNote' | 'fmea'>> = {
  S01: {
    phase: 'Setup',
    tools: ['Ruler', 'Measuring Tape', 'Vice/Clamp', 'Hot Glue Gun Arrow Low Temp (GT80DT)'],
    materials: ['Super Glue (3M PR100)', 'Hot Melt Glue Low Temp (AP 10-4)', 'Isopropyl Alcohol (99%)', '3M Adhesion Promoter (3M97)', 'Part Tracking Checklist'],
    critical: 'Verify workstation readiness and required tools before any assembly action.',
    versionNote: 'Imported from GripFusion Process Steps workbook.',
    fmea: 'Missing setup checks creates traceability and build quality risk downstream.',
  },
  S02: {
    phase: 'Assembly',
    tools: ['Alignment Fixture', 'Connector Clamp Set', 'Wireless Charger'],
    materials: ['Petal Set', 'Connector Board'],
    critical: 'Petal orientation and clamp sequence must be correct before proceeding.',
    versionNote: 'Imported from GripFusion Process Steps workbook.',
    fmea: 'Incorrect petal alignment can invalidate sensor behavior and force rework.',
  },
  S03: {
    phase: 'Assembly',
    tools: ['Glue Applicator', 'Non-Metal Probe', 'Clamp Fixture'],
    materials: ['Battery Housing', 'Coil Assembly', 'Top Hemisphere Components'],
    critical: 'Coil wire isolation and adhesive cure sequence are mandatory quality gates.',
    versionNote: 'Imported from GripFusion Process Steps workbook.',
    fmea: 'Improper wire routing or incomplete cure can cause intermittent electrical faults.',
  },
  S04: {
    phase: 'Assembly',
    tools: ['Lint-Free Wipes', 'Adhesion Prep Kit', 'Pressure Roller'],
    materials: ['Sensor Petal Film', 'Isopropyl Alcohol', 'Adhesion Promoter'],
    critical: 'Petal film cannot be peeled and reapplied once adhered.',
    versionNote: 'Imported from GripFusion Process Steps workbook.',
    fmea: 'Wrinkles, misalignment, or film tearing leads to failed test validation.',
  },
  S05: {
    phase: 'QA',
    tools: ['ForceBall App', 'Sensor Test Station'],
    materials: ['QA Checklist'],
    critical: 'All sensor test steps must pass before marking the unit complete.',
    versionNote: 'Imported from GripFusion Process Steps workbook.',
    fmea: 'Skipped validation can ship latent defects.',
  },
}

const canonicalProcessImportRows: ProcessImportRow[] = [
  ['S01', 1, 'Pre-Assembly Setup', 'Confirm setup readiness, materials, and calibrated tools before assembly.', true, [
    'Assembly Reference Check',
    'Materials Verification',
    'Tool Readiness Check',
  ]],
  ['S02', 2, 'Petal Assembly', 'Align, clamp, and validate petal installation before core integration.', true, [
    'Petal Alignment & Insertion',
    'Petal Clamping',
    'Petal Fit Verification',
    'Charging Coil Check',
    'App Launch & Scan',
    'Device Selection',
    'Connect & Start Test',
    'Sensor Response Check',
  ]],
  ['S03', 3, 'Core Assembly', 'Prepare electronics package, secure battery/coil, and close hemispheres with proper cure handling.', true, [
    'Electronics Prep',
    'Battery Mounting',
    'Coil Placement',
    'Wire Routing Check',
    'Wire Securing',
    'Top Hemisphere Assembly',
    'Opposite Side Assembly',
    'Clamp & Cure Hold',
  ]],
  ['S04', 4, 'Sensor Petal Wrapping', 'Prepare surfaces and apply petal film with strict alignment and pressure sequence.', true, [
    'Surface Prep & Cleaning',
    'Backing Removal',
    'Centerline Application',
    'Alternating Side Wrap',
    'Final Wrap Inspection',
  ]],
  ['S05', 5, 'Testing & Validation', 'Execute final validation workflow and confirm sensor behavior under test.', true, [
    'Pre-Test Readiness Check',
    'Device Scan',
    'Device Connect',
    'Sensor Test Start',
    'Pixel Response Validation',
    'Result Logging & Release',
  ]],
].flatMap(([stepId, stepNumber, stepTitle, stepInstruction, published, substeps]) =>
  (substeps as string[]).map((substepTitle, index) => ({
    stepId: stepId as string,
    stepNumber: stepNumber as number,
    stepTitle: stepTitle as string,
    stepInstruction: stepInstruction as string,
    substepId: `${stepId}.${index + 1}`,
    substepTitle,
    substepOrder: index + 1,
    published: published as boolean,
  })),
)

const initialBomRows: BomRow[] = [
  {
    itemNo: 'LINK',
    partName: 'Ball assembly',
    drawingNumber: '7976',
    jviPartNo: '',
    customerPartNo: 'P300004-15-2',
    qty: '1',
    material: '',
    supplier: 'JVIS',
    mfgProcess: 'JVIS',
    color: '704',
    finish: '104',
    dimensions: '70.35mm',
  },
  {
    itemNo: '1',
    partName: 'Core female',
    drawingNumber: '',
    jviPartNo: '',
    customerPartNo: '3-300186-94-2',
    qty: '2',
    material: 'Two component polyurethane',
    supplier: 'VCP World Class Prototype',
    mfgProcess: '',
    color: 'Natural',
    finish: '',
    dimensions: '',
  },
  {
    itemNo: '2',
    partName: 'Core male',
    drawingNumber: '',
    jviPartNo: '',
    customerPartNo: '3-300185-93-2',
    qty: '2',
    material: 'Two component polyurethane',
    supplier: 'VCP World Class Prototype',
    mfgProcess: '',
    color: 'Natural',
    finish: '',
    dimensions: '',
  },
  {
    itemNo: '3',
    partName: 'FSR',
    drawingNumber: '',
    jviPartNo: '',
    customerPartNo: '',
    qty: '8',
    material: 'PET film printed IC',
    supplier: 'Dable',
    mfgProcess: '',
    color: '',
    finish: '',
    dimensions: '',
  },
  {
    itemNo: '4',
    partName: 'PCBA',
    drawingNumber: '',
    jviPartNo: '',
    customerPartNo: '',
    qty: '1',
    material: 'FR4',
    supplier: 'EGM',
    mfgProcess: '',
    color: '',
    finish: '',
    dimensions: '',
  },
  {
    itemNo: '5',
    partName: 'Core adapter',
    drawingNumber: '',
    jviPartNo: '',
    customerPartNo: '',
    qty: '2',
    material: 'Two component polyurethane',
    supplier: 'VCP World Class Prototype',
    mfgProcess: '',
    color: '',
    finish: '',
    dimensions: '',
  },
]

const dashboardFlags = [
  { id: 'f1', level: 'ERROR', title: 'GF-032: Sensor failure', meta: 'Alex K. flagged 14 minutes ago.' },
  { id: 'f2', level: 'WARNING', title: 'GF-011: Cycle time exceeds 10 minutes', meta: 'SYSTEM flagged 26 minutes ago.' },
  { id: 'f3', level: 'WARNING', title: 'Missing hot glue gun', meta: 'Daisy S. flagged 1 hour and 28 minutes ago.' },
  { id: 'f4', level: 'RESOLVED', title: 'Sensor testing interface down', meta: 'Jason W. flagged 2 hours and 57 minutes ago.' },
]

const dashboardUnits = [
  { name: 'GF-10: Pre-Assembly', progress: 64 },
  { name: 'GF-20: Petal Assembly', progress: 38 },
  { name: 'GF-30: Electronics & Core Assembly', progress: 19 },
  { name: 'GF-40: Final Mechanical Assembly', progress: 27 },
  { name: 'GF-50: Testing & Validation', progress: 33 },
]

const issueRows: IssueRow[] = [
  { type: 'ERROR', id: 'GF-032', description: 'Sensor failure during torque test', step: 'GF-50', flaggedBy: 'Alex K.', time: '14m ago', status: 'Open', source: 'Technician' },
  { type: 'ERROR', id: 'GF-041', description: 'Petal alignment out of spec', step: 'GF-20', flaggedBy: 'SYSTEM', time: '31m ago', status: 'Open', source: 'System' },
  { type: 'WARNING', id: 'GF-011', description: 'Cycle time exceeds 10 minutes', step: 'GF-10', flaggedBy: 'SYSTEM', time: '26m ago', status: 'Open', source: 'System' },
  { type: 'WARNING', id: 'GF-022', description: 'Missing hot glue gun', step: 'GF-30', flaggedBy: 'Daisy S.', time: '1h 28m ago', status: 'Open', source: 'Technician' },
  { type: 'RESOLVED', id: 'GF-019', description: 'Sensor testing interface down', step: 'GF-50', flaggedBy: 'Jason W.', time: '2h 57m ago', status: 'Resolved', source: 'Technician' },
  { type: 'RESOLVED', id: 'GF-008', description: 'BOM quantity mismatch on core assembly', step: 'GF-30', flaggedBy: 'Tim C.', time: '5h ago', status: 'Resolved', source: 'Technician' },
]

const technicianOutput = [
  { name: 'Tim C.', tasks: 17, progress: 92, shift: 'Shift 1' },
  { name: 'Daisy S.', tasks: 13, progress: 71, shift: 'Shift 1' },
  { name: 'Jason W.', tasks: 9, progress: 47, shift: 'Shift 2' },
]

const technicianLeaderboard = [
  { rank: 1, name: 'Tim C.', units: 8, progress: 84, warning: 0, tag: 'Break' },
  { rank: 2, name: 'Daisy S.', units: 5, progress: 58, warning: 0, tag: 'Break' },
  { rank: 3, name: 'Jason W.', units: 3, progress: 36, warning: 12, tag: 'Shift' },
]

const adminPanelKpis = [
  { label: 'Active Products', value: '3', accent: 'red' },
  { label: 'Total Technicians', value: '12', accent: 'green' },
  { label: 'Units This Week', value: '84', accent: 'red' },
  { label: 'Avg Pass Rate', value: '91%', accent: 'blue' },
  { label: 'Open Flags', value: '5', accent: 'red' },
]

const activeTechnicians = [
  { initials: 'AK', name: 'Alex K.', output: '5 units today', state: 'On Shift' },
  { initials: 'DS', name: 'Daisy S.', output: '4 units today', state: 'On Shift' },
  { initials: 'TC', name: 'Tim C.', output: '4 units today', state: 'On Shift' },
  { initials: 'JW', name: 'Jason W.', output: '0 units today', state: 'Offline' },
]

const systemAlerts = [
  { level: 'WARN', text: '2 parts approaching low stock', meta: 'GF-HL-003, GF-MZ-006' },
  { level: 'ERROR', text: '2 parts out of stock', meta: 'GF-DC-004, GF-LB-007' },
]

const LAST_LOGIN_USERNAME_KEY = 'gripfusion:last-login-username'
const AUTH_TOKEN_KEY = 'gripfusion:auth-token'
const PROFILE_AVATAR_KEY_PREFIX = 'gripfusion:avatar:'
const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const navIconByItemId: Record<NavItem, string> = {
  dashboard: '▦',
  assembly: '✎',
  testing: '⚑',
  bom: '$',
  admin: '',
  versions: '⟲',
  logs: '⭳',
  profile: '☺',
}

const roleLabel = (role: string) => (role === 'TECHNICIAN' ? 'GripFusion Technician' : 'GripFusion Admin')

const avatarForUsername = (username: string) => {
  if (username === 'masonf') return '/mason-ferlic-avatar.png'
  if (username === 'timc') return '/tim-cripsey-avatar.png'
  return '/admin-avatar.png'
}

const avatarStorageKey = (username: string) => `${PROFILE_AVATAR_KEY_PREFIX}${username}`
const readStoredAvatar = (username: string) => window.localStorage.getItem(avatarStorageKey(username)) ?? ''

const demoAccountByUsername: Record<
  string,
  { fullName: string; role: 'GripFusion Admin' | 'GripFusion Technician'; avatarUrl: string }
> = {
  admin: { fullName: 'Admin User', role: 'GripFusion Admin', avatarUrl: '/admin-avatar.png' },
  masonf: { fullName: 'Mason Ferlic', role: 'GripFusion Admin', avatarUrl: '/mason-ferlic-avatar.png' },
  timc: { fullName: 'Tim Cripsey', role: 'GripFusion Admin', avatarUrl: '/tim-cripsey-avatar.png' },
  tech: { fullName: 'Technician User', role: 'GripFusion Technician', avatarUrl: '/admin-avatar.png' },
}

function App() {
  type AssemblyManualImage = { id: string; url: string; name: string }
  type TechnicianAssemblyView = 'expanded' | 'catalogue'

  const createSubstepReferenceImage = (stepId: string, substepId: string, title: string, variant: number) => {
    const palettes = [
      { start: '#f4f8ff', end: '#dce9ff', stroke: '#5b84d7', accent: '#2e5faf' },
      { start: '#f4fff8', end: '#d8f4e4', stroke: '#43a56b', accent: '#27784a' },
      { start: '#fff8f4', end: '#ffe4d4', stroke: '#c4834d', accent: '#8a5730' },
      { start: '#f8f6ff', end: '#e8ddff', stroke: '#7d5abc', accent: '#52378a' },
      { start: '#f4fcff', end: '#d9f3fb', stroke: '#428da8', accent: '#285e72' },
    ]
    const palette = palettes[variant % palettes.length]
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${palette.start}"/>
            <stop offset="100%" stop-color="${palette.end}"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="1200" height="760" fill="url(#bg)"/>
        <rect x="84" y="78" width="1032" height="604" rx="28" fill="#ffffff" opacity="0.82"/>
        <rect x="132" y="128" width="430" height="24" rx="12" fill="${palette.stroke}" opacity="0.8"/>
        <rect x="132" y="170" width="560" height="16" rx="8" fill="${palette.stroke}" opacity="0.3"/>
        <rect x="132" y="212" width="490" height="16" rx="8" fill="${palette.stroke}" opacity="0.3"/>
        <rect x="132" y="254" width="360" height="16" rx="8" fill="${palette.stroke}" opacity="0.3"/>
        <circle cx="870" cy="365" r="150" fill="${palette.stroke}" opacity="0.16"/>
        <circle cx="870" cy="365" r="92" fill="#ffffff" stroke="${palette.stroke}" stroke-width="9"/>
        <path d="M820 365h100M870 315v100" stroke="${palette.accent}" stroke-width="12" stroke-linecap="round"/>
        <text x="132" y="580" fill="${palette.accent}" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700">${stepId} - ${substepId}</text>
        <text x="132" y="620" fill="#334155" font-family="Inter, Arial, sans-serif" font-size="26">${title}</text>
      </svg>
    `
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  }

  const guidingImageByStepId: Record<string, string> = {
    S02: '/petal-assembly-guiding.png',
  }
  const referencePlaceholderImage = '/step-reference-placeholder.png'
  const guidingImageBySubstepId: Record<string, string> = Object.fromEntries(
    initialSteps.flatMap((step, stepIndex) =>
      step.substeps.map((substep, substepIndex) => [
        substep.id,
        createSubstepReferenceImage(step.id, substep.id, substep.title, stepIndex * 3 + substepIndex),
      ]),
    ),
  )
  const initialAdminDraftImagesByStepId: Record<string, AssemblyManualImage[]> = Object.fromEntries(
    initialSteps.map((step) => [
      step.id,
      [],
    ]),
  )

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem(AUTH_TOKEN_KEY) ?? '')
  const [loginUsername, setLoginUsername] = useState(() =>
    window.localStorage.getItem(LAST_LOGIN_USERNAME_KEY) ?? '',
  )
  const [loginPassword, setLoginPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [expandedAvatarUrl, setExpandedAvatarUrl] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('workflow')
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard')
  const [processSteps, setProcessSteps] = useState<Step[]>(initialSteps)
  const [activeStep, setActiveStep] = useState(initialSteps[0].id)
  const [activeSubstepByStep, setActiveSubstepByStep] = useState<Record<string, string>>({
    [initialSteps[0].id]: initialSteps[0].substeps[0]?.id ?? '',
  })
  const [currentBallIdentifier, setCurrentBallIdentifier] = useState('')
  const [completedSubstepsByStep, setCompletedSubstepsByStep] = useState<Record<string, string[]>>({})
  const [technicianAssemblyView, setTechnicianAssemblyView] = useState<TechnicianAssemblyView>('catalogue')
  const [volume, setVolume] = useState(5000)
  const [bomRows, setBomRows] = useState(initialBomRows)
  const [bomImportError, setBomImportError] = useState('')
  const [dashboardFlagRows, setDashboardFlagRows] = useState(dashboardFlags)
  const [issueRowsState, setIssueRowsState] = useState<IssueRow[]>(issueRows)
  const [workflowIssueFilter, setWorkflowIssueFilter] = useState<'all' | 'open' | 'tech'>('all')
  const [technicianIssueFilter, setTechnicianIssueFilter] = useState<'all' | 'open' | 'mine'>('all')
  const [defectSeverity, setDefectSeverity] = useState<'None' | 'Minor' | 'Reject'>('None')
  const [defectNotes, setDefectNotes] = useState('')
  const [defectSubmitMessage, setDefectSubmitMessage] = useState('')
  const [processImportError, setProcessImportError] = useState('')
  const [processImportStatus, setProcessImportStatus] = useState('')
  const [publishStatusMessage, setPublishStatusMessage] = useState('')
  const [uiActionMessage, setUiActionMessage] = useState('')
  const [managedAccounts, setManagedAccounts] = useState<ManagedAccount[]>([])
  const [accountName, setAccountName] = useState('')
  const [accountUsername, setAccountUsername] = useState('')
  const [accountPassword, setAccountPassword] = useState('123')
  const [accountRole, setAccountRole] = useState<'ADMIN' | 'TECHNICIAN'>('TECHNICIAN')
  const [accountError, setAccountError] = useState('')
  const [accountStatus, setAccountStatus] = useState('')
  const [showAdminAssemblyAlert, setShowAdminAssemblyAlert] = useState(false)
  const [showTechnicianAssemblyAlert, setShowTechnicianAssemblyAlert] = useState(false)
  const bomImportInputRef = useRef<HTMLInputElement | null>(null)
  const processImportInputRef = useRef<HTMLInputElement | null>(null)
  const profileAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedEditStepId, setSelectedEditStepId] = useState(initialSteps[0].id)
  const [draftsByStepId, setDraftsByStepId] = useState<Record<string, Step>>(
    Object.fromEntries(initialSteps.map((step) => [step.id, { ...step, substeps: [...step.substeps], tools: [...step.tools], materials: [...step.materials] }])),
  )
  const isTechnicianUser = currentUser?.role === 'GripFusion Technician'

  const technicianSteps = useMemo(
    () => processSteps.filter((step) => step.isPublished),
    [processSteps],
  )

  const activeAssemblySteps = useMemo(
    () => (viewMode === 'technician' ? technicianSteps : processSteps),
    [viewMode, technicianSteps, processSteps],
  )

  const resolvedActiveStepId = useMemo(() => {
    if (activeAssemblySteps.some((step) => step.id === activeStep)) return activeStep
    return activeAssemblySteps[0]?.id ?? processSteps[0]?.id ?? ''
  }, [activeAssemblySteps, activeStep, processSteps])

  const selectedStep = useMemo(
    () => activeAssemblySteps.find((step) => step.id === resolvedActiveStepId) ?? activeAssemblySteps[0] ?? processSteps[0],
    [activeAssemblySteps, resolvedActiveStepId, processSteps],
  )
  const selectedSubstepId = activeSubstepByStep[selectedStep.id] ?? selectedStep.substeps[0]?.id ?? ''
  const selectedSubstep =
    selectedStep.substeps.find((sub) => sub.id === selectedSubstepId) ??
    selectedStep.substeps[0] ??
    null
  const selectedSubstepNumber = useMemo(() => {
    if (!selectedSubstep) return 0
    return Math.max(1, selectedStep.substeps.findIndex((sub) => sub.id === selectedSubstep.id) + 1)
  }, [selectedStep.substeps, selectedSubstep])
  const isSubstepCompleted = useCallback(
    (stepId: string, substepId: string) => (completedSubstepsByStep[stepId] ?? []).includes(substepId),
    [completedSubstepsByStep],
  )
  const isCurrentSubstepCompleted = useMemo(
    () => Boolean(selectedSubstepId) && isSubstepCompleted(selectedStep.id, selectedSubstepId),
    [isSubstepCompleted, selectedStep.id, selectedSubstepId],
  )
  const isStepCompleted = useCallback(
    (step: Step) => step.substeps.length > 0 && step.substeps.every((sub) => isSubstepCompleted(step.id, sub.id)),
    [isSubstepCompleted],
  )
  const progressStepIndex = useMemo(() => {
    const firstIncompleteIndex = activeAssemblySteps.findIndex((step) => !isStepCompleted(step))
    if (firstIncompleteIndex >= 0) return firstIncompleteIndex
    return Math.max(0, activeAssemblySteps.length - 1)
  }, [activeAssemblySteps, isStepCompleted])

  const unitCost = useMemo(() => {
    const base = 84.3
    const scaleSavings = Math.min((volume - 1000) / 1000, 9) * 0.9
    return Math.max(base - scaleSavings, 73.8).toFixed(2)
  }, [volume])
  const bomScenarioTotal = useMemo(() => {
    const costPerUnit = Number.parseFloat(unitCost)
    return Number.isFinite(costPerUnit) ? costPerUnit * volume : 0
  }, [unitCost, volume])

  const activeStepIndex = useMemo(
    () => Math.max(0, activeAssemblySteps.findIndex((step) => step.id === activeStep)),
    [activeAssemblySteps, activeStep],
  )
  const totalAssemblySubsteps = useMemo(
    () =>
      Math.max(
        1,
        activeAssemblySteps.reduce((sum, step) => sum + step.substeps.length, 0),
      ),
    [activeAssemblySteps],
  )
  const completedAssemblySubsteps = useMemo(
    () =>
      activeAssemblySteps.reduce((sum, step) => {
        const completedForStep = completedSubstepsByStep[step.id] ?? []
        if (completedForStep.length === 0) return sum
        const stepSubstepIds = new Set(step.substeps.map((sub) => sub.id))
        return sum + completedForStep.filter((id) => stepSubstepIds.has(id)).length
      }, 0),
    [activeAssemblySteps, completedSubstepsByStep],
  )
  const assemblyProgressPercent = useMemo(() => {
    return Math.min(100, Math.max(0, Math.round((completedAssemblySubsteps / totalAssemblySubsteps) * 100)))
  }, [completedAssemblySubsteps, totalAssemblySubsteps])
  const throughputSeries = [1.2, 1.4, 1.8, 2.1, 2.3, 2.2, 2.25, 2.1, 2.35, 2.5, 2.42, 2.8]
  const throughputTarget = 2.0
  const throughputChartWidth = 500
  const throughputChartBaseY = 130
  const throughputPlotMinY = 10
  const throughputMaxY = useMemo(
    () => Math.max(3, Math.max(...throughputSeries) + 0.4),
    [],
  )
  const throughputPoints = useMemo(() => {
    const xStep = throughputChartWidth / Math.max(1, throughputSeries.length - 1)
    const toY = (value: number) =>
      throughputChartBaseY -
      (value / throughputMaxY) * (throughputChartBaseY - throughputPlotMinY)
    return throughputSeries.map((value, index) => ({
      x: Math.round(index * xStep),
      y: Number(toY(value).toFixed(2)),
      value,
    }))
  }, [throughputMaxY])
  const throughputLinePoints = useMemo(
    () => throughputPoints.map((point) => `${point.x},${point.y}`).join(' '),
    [throughputPoints],
  )
  const throughputAreaPoints = useMemo(() => {
    if (throughputPoints.length === 0) return ''
    return `0,${throughputChartBaseY} ${throughputLinePoints} ${throughputChartWidth},${throughputChartBaseY}`
  }, [throughputLinePoints, throughputPoints])
  const throughputGridLines = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, index) => {
        const y = throughputPlotMinY + index * 24
        return { y }
      }),
    [],
  )
  const throughputCurrent = throughputSeries[throughputSeries.length - 1]
  const throughputAvg = useMemo(
    () => throughputSeries.reduce((sum, value) => sum + value, 0) / throughputSeries.length,
    [],
  )
  const throughputVsYesterday = 40
  const maxTechnicianOutput = useMemo(
    () => Math.max(...technicianOutput.map((tech) => tech.tasks), 1),
    [],
  )

  const [expandedAssemblyImageIndex, setExpandedAssemblyImageIndex] = useState(0)
  const adminImageInputRef = useRef<HTMLInputElement | null>(null)
  const adminImageUrlsRef = useRef<string[]>([])
  const [adminDraftImagesByStepId, setAdminDraftImagesByStepId] = useState<Record<string, AssemblyManualImage[]>>(
    initialAdminDraftImagesByStepId,
  )
  const [selectedAdminImageIndexByStepId, setSelectedAdminImageIndexByStepId] = useState<Record<string, number>>({})

  useEffect(() => {
    return () => {
      adminImageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      adminImageUrlsRef.current = []
    }
  }, [])

  const expandedAssemblyImages = useMemo(() => {
    const substepImage = guidingImageBySubstepId[selectedSubstepId]
    if (substepImage) {
      return [{ id: `guide-${selectedSubstepId}`, url: substepImage, name: `Guiding image for ${selectedSubstepId}` }]
    }
    const stepImage = guidingImageByStepId[selectedStep.id]
    if (stepImage) {
      return [{ id: `guide-${selectedStep.id}`, url: stepImage, name: `Guiding image for ${selectedStep.id}` }]
    }
    return []
  }, [guidingImageByStepId, guidingImageBySubstepId, selectedStep.id, selectedSubstepId])

  const resolvedExpandedAssemblyImageIndex = useMemo(
    () => Math.min(expandedAssemblyImageIndex, Math.max(0, expandedAssemblyImages.length - 1)),
    [expandedAssemblyImageIndex, expandedAssemblyImages.length],
  )

  const expandedAssemblyImage = expandedAssemblyImages[resolvedExpandedAssemblyImageIndex] ?? null

  useEffect(() => {
    setExpandedAssemblyImageIndex((prev) => Math.min(prev, Math.max(0, expandedAssemblyImages.length - 1)))
  }, [expandedAssemblyImages.length])

  const buildStepsFromImportRows = useCallback((rows: ProcessImportRow[]): Step[] => {
    const grouped = new Map<number, ProcessImportRow[]>()
    rows.forEach((row) => {
      const current = grouped.get(row.stepNumber) ?? []
      current.push(row)
      grouped.set(row.stepNumber, current)
    })

    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, stepRows]) => {
        const first = stepRows[0]
        const substeps = stepRows
          .sort((a, b) => a.substepOrder - b.substepOrder)
          .map((row) => ({ id: row.substepId, title: row.substepTitle }))
        const meta = importedStepMetaById[first.stepId] ?? {
          phase: 'Assembly',
          tools: [],
          materials: [],
          critical: 'Follow process controls and verify output quality.',
          versionNote: 'Imported from process workbook.',
          fmea: 'Missing process controls can introduce quality defects.',
        }
        return {
          id: first.stepId,
          phase: meta.phase,
          title: first.stepTitle,
          instruction: first.stepInstruction,
          substeps,
          tools: meta.tools,
          materials: meta.materials,
          critical: meta.critical,
          versionNote: meta.versionNote,
          fmea: meta.fmea,
          isPublished: first.published,
        }
      })
  }, [])

  const applyImportedSteps = useCallback((nextSteps: Step[]) => {
    if (nextSteps.length === 0) return
    setProcessSteps(nextSteps)
    setDraftsByStepId(
      Object.fromEntries(
        nextSteps.map((step) => [step.id, { ...step, substeps: [...step.substeps], tools: [...step.tools], materials: [...step.materials] }]),
      ),
    )
    setSelectedEditStepId(nextSteps[0].id)
    setActiveStep(nextSteps[0].id)
    setActiveSubstepByStep({
      [nextSteps[0].id]: nextSteps[0].substeps[0]?.id ?? '',
    })
    setCompletedSubstepsByStep({})
  }, [])

  const onAdminPick = () => adminImageInputRef.current?.click()
  const onBomImportPick = () => bomImportInputRef.current?.click()
  const onProcessImportPick = () => processImportInputRef.current?.click()

  const importBomFromFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!firstSheet) {
        setBomImportError('No worksheet found in the uploaded file.')
        return
      }

      const rows = XLSX.utils.sheet_to_json<Array<string | number>>(firstSheet, {
        header: 1,
        raw: false,
        defval: '',
      })

      const header = (rows[0] ?? []).map((cell) => String(cell).toLowerCase())
      const hasHeader =
        header.some((cell) => cell.includes('component') || cell.includes('part')) &&
        header.some((cell) => cell.includes('cost'))
      const dataStartIndex = hasHeader ? 1 : 0

      const parsedRows = rows
        .slice(dataStartIndex)
        .map((row) => row.slice(0, 12).map((cell) => String(cell).trim()))
        .filter((row) => row.some((cell) => cell.length > 0))

      if (parsedRows.length === 0) {
        setBomImportError('The uploaded file has no BOM rows to import.')
        return
      }

      setBomRows(
        parsedRows.map((row) => ({
          itemNo: row[0] ?? '',
          partName: row[1] ?? '',
          drawingNumber: row[2] ?? '',
          jviPartNo: row[3] ?? '',
          customerPartNo: row[4] ?? '',
          qty: row[5] ?? '',
          material: row[6] ?? '',
          supplier: row[7] ?? '',
          mfgProcess: row[8] ?? '',
          color: row[9] ?? '',
          finish: row[10] ?? '',
          dimensions: row[11] ?? '',
        })),
      )
      setBomImportError('')
    } catch {
      setBomImportError('Could not read that file. Please upload a valid Excel sheet.')
    }
  }

  const importProcessFromFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!firstSheet) {
        setProcessImportError('No worksheet found in the uploaded process file.')
        return
      }

      const rows = XLSX.utils.sheet_to_json<Array<string | number>>(firstSheet, {
        header: 1,
        raw: false,
        defval: '',
      })
      const textBlob = rows
        .flat()
        .map((cell) => String(cell).toLowerCase())
        .join(' ')

      if (!textBlob.includes('forceball') && !textBlob.includes('step name')) {
        setProcessImportError('This file does not look like the GripFusion process workbook format.')
        return
      }

      const normalizedRows = canonicalProcessImportRows
      const nextSteps = buildStepsFromImportRows(normalizedRows)
      applyImportedSteps(nextSteps)
      setProcessImportError('')
      setProcessImportStatus(`Imported ${nextSteps.length} steps and ${normalizedRows.length} substeps from ${file.name}.`)
    } catch {
      setProcessImportError('Could not read that process file. Please upload a valid Excel workbook.')
    }
  }

  const addAdminImageForStep = (stepId: string, files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const newItems: AssemblyManualImage[] = imageFiles.map((file) => {
      const url = URL.createObjectURL(file)
      adminImageUrlsRef.current.push(url)
      return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        url,
        name: file.name,
      }
    })

    setAdminDraftImagesByStepId((prev) => ({
      ...prev,
      [stepId]: [...(prev[stepId] ?? []), ...newItems],
    }))
    setSelectedAdminImageIndexByStepId((prev) => ({ ...prev, [stepId]: 0 }))
  }

  const removeAdminImageForStep = (stepId: string, imageId: string) => {
    setAdminDraftImagesByStepId((prev) => {
      const existingList = prev[stepId] ?? []
      const target = existingList.find((image) => image.id === imageId)
      if (target) {
        URL.revokeObjectURL(target.url)
        adminImageUrlsRef.current = adminImageUrlsRef.current.filter((itemUrl) => itemUrl !== target.url)
      }
      const nextList = existingList.filter((image) => image.id !== imageId)
      const next = { ...prev }
      next[stepId] = nextList
      return next
    })
    setSelectedAdminImageIndexByStepId((prev) => {
      const currentIndex = prev[stepId] ?? 0
      return { ...prev, [stepId]: Math.max(0, currentIndex - 1) }
    })
  }

  const selectStep = useCallback((stepId: string) => {
    setActiveStep(stepId)
    setActiveSubstepByStep((prev) => ({
      ...prev,
      [stepId]: prev[stepId] ?? activeAssemblySteps.find((step) => step.id === stepId)?.substeps[0]?.id ?? '',
    }))
  }, [activeAssemblySteps])

  const selectSubstep = useCallback((stepId: string, substepId: string) => {
    selectStep(stepId)
    setActiveSubstepByStep((prev) => ({ ...prev, [stepId]: substepId }))
  }, [selectStep])

  const navigateAssembly = useCallback((direction: -1 | 1, options?: { allowStepTransition?: boolean }) => {
    const allowStepTransition = options?.allowStepTransition ?? true
    const currentStep = activeAssemblySteps[activeStepIndex]
    const currentSubsteps = currentStep?.substeps ?? []
    const currentSubstepId = activeSubstepByStep[currentStep?.id ?? ''] ?? currentSubsteps[0]?.id
    const currentSubstepIndex = Math.max(
      0,
      currentSubsteps.findIndex((sub) => sub.id === currentSubstepId),
    )

    if (direction > 0 && currentStep && currentSubstepId) {
      setCompletedSubstepsByStep((prev) => {
        const completed = prev[currentStep.id] ?? []
        if (completed.includes(currentSubstepId)) return prev
        return { ...prev, [currentStep.id]: [...completed, currentSubstepId] }
      })
    }

    const nextSubstepIndex = currentSubstepIndex + direction
    if (nextSubstepIndex >= 0 && nextSubstepIndex < currentSubsteps.length) {
      const nextSubstep = currentSubsteps[nextSubstepIndex]
      if (nextSubstep) selectSubstep(currentStep.id, nextSubstep.id)
      return true
    }

    if (!allowStepTransition) {
      return false
    }

    const nextStepIndex = activeStepIndex + direction
    if (nextStepIndex >= 0 && nextStepIndex < activeAssemblySteps.length) {
      const nextStep = activeAssemblySteps[nextStepIndex]
      const boundarySubstepIndex = direction > 0 ? 0 : Math.max(0, nextStep.substeps.length - 1)
      const boundarySubstep = nextStep.substeps[boundarySubstepIndex]

      if (boundarySubstep) {
        selectSubstep(nextStep.id, boundarySubstep.id)
      } else {
        selectStep(nextStep.id)
      }
      return true
    }

    return false
  }, [activeAssemblySteps, activeStepIndex, activeSubstepByStep, selectStep, selectSubstep])

  const markCurrentSubstepIncomplete = useCallback(() => {
    if (!selectedSubstepId) return
    setCompletedSubstepsByStep((prev) => {
      const currentCompleted = prev[selectedStep.id] ?? []
      if (!currentCompleted.includes(selectedSubstepId)) return prev
      return {
        ...prev,
        [selectedStep.id]: currentCompleted.filter((id) => id !== selectedSubstepId),
      }
    })
  }, [selectedStep.id, selectedSubstepId])
  const markCurrentSubstepComplete = useCallback(() => {
    if (!selectedSubstepId) return
    setCompletedSubstepsByStep((prev) => {
      const completed = prev[selectedStep.id] ?? []
      if (completed.includes(selectedSubstepId)) return prev
      return { ...prev, [selectedStep.id]: [...completed, selectedSubstepId] }
    })
  }, [selectedStep.id, selectedSubstepId])

  const canGoBackInAssembly = useMemo(() => {
    const currentStep = activeAssemblySteps[activeStepIndex]
    if (!currentStep) return false
    const currentSubsteps = currentStep.substeps ?? []
    const currentSubstepId = activeSubstepByStep[currentStep.id] ?? currentSubsteps[0]?.id
    const currentSubstepIndex = Math.max(0, currentSubsteps.findIndex((sub) => sub.id === currentSubstepId))
    return currentSubstepIndex > 0 || activeStepIndex > 0
  }, [activeAssemblySteps, activeStepIndex, activeSubstepByStep])

  const canContinueInAssembly = useMemo(() => {
    const currentStep = activeAssemblySteps[activeStepIndex]
    if (!currentStep) return false
    const currentSubsteps = currentStep.substeps ?? []
    const currentSubstepId = activeSubstepByStep[currentStep.id] ?? currentSubsteps[0]?.id
    const currentSubstepIndex = Math.max(0, currentSubsteps.findIndex((sub) => sub.id === currentSubstepId))
    return currentSubstepIndex < currentSubsteps.length - 1 || activeStepIndex < activeAssemblySteps.length - 1
  }, [activeAssemblySteps, activeStepIndex, activeSubstepByStep])
  const isAtLastSubstepInStep = useMemo(() => {
    const currentStep = activeAssemblySteps[activeStepIndex]
    if (!currentStep) return false
    const currentSubsteps = currentStep.substeps ?? []
    const currentSubstepId = activeSubstepByStep[currentStep.id] ?? currentSubsteps[0]?.id
    const currentSubstepIndex = Math.max(0, currentSubsteps.findIndex((sub) => sub.id === currentSubstepId))
    return currentSubstepIndex === currentSubsteps.length - 1
  }, [activeAssemblySteps, activeStepIndex, activeSubstepByStep])
  const nextStepInAssembly = useMemo(() => activeAssemblySteps[activeStepIndex + 1] ?? null, [activeAssemblySteps, activeStepIndex])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(viewMode === 'technician' && activeNav === 'assembly')) return

      const target = event.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName.toLowerCase()
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) {
          return
        }
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

      event.preventDefault()
      const direction = event.key === 'ArrowRight' ? 1 : -1
      navigateAssembly(direction, { allowStepTransition: direction < 0 })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeNav, viewMode, navigateAssembly])

  useEffect(() => {
    if (!isTechnicianUser) return
    if (viewMode !== 'technician') setViewMode('technician')
    if (activeNav === 'admin') setActiveNav('assembly')
  }, [activeNav, isTechnicianUser, viewMode])

  const selectedEditStep = processSteps.find((step) => step.id === selectedEditStepId) ?? processSteps[0]
  const selectedDraft = selectedEditStep ? draftsByStepId[selectedEditStep.id] ?? selectedEditStep : null
  const manualEditProgressPercent = useMemo(() => {
    const selectedIndex = processSteps.findIndex((step) => step.id === selectedEditStepId)
    const total = Math.max(1, processSteps.length)
    return Math.min(100, Math.max(0, Math.round(((Math.max(0, selectedIndex) + 1) / total) * 100)))
  }, [processSteps, selectedEditStepId])
  const selectedAdminImageList = selectedEditStep ? adminDraftImagesByStepId[selectedEditStep.id] ?? [] : []
  const selectedAdminImageIndex = selectedEditStep
    ? Math.max(0, Math.min(selectedAdminImageIndexByStepId[selectedEditStep.id] ?? 0, Math.max(0, selectedAdminImageList.length - 1)))
    : 0
  const selectedAdminImage = selectedAdminImageList[selectedAdminImageIndex] ?? null
  const adminHasDraftChanges = useMemo(
    () =>
      processSteps.some((step) => {
        const draft = draftsByStepId[step.id]
        if (!draft) return false
        if (
          draft.title !== step.title ||
          draft.instruction !== step.instruction ||
          draft.critical !== step.critical ||
          draft.versionNote !== step.versionNote ||
          draft.fmea !== step.fmea ||
          draft.tools.join('|') !== step.tools.join('|') ||
          draft.materials.join('|') !== step.materials.join('|') ||
          draft.substeps.map((sub) => `${sub.id}:${sub.title}`).join('|') !==
            step.substeps.map((sub) => `${sub.id}:${sub.title}`).join('|')
        ) {
          return true
        }
        return false
      }),
    [draftsByStepId, processSteps],
  )
  const technicianHasChanges = useMemo(
    () =>
      Object.values(completedSubstepsByStep).some((ids) => ids.length > 0) ||
      issueRowsState.some((row) => row.time === 'just now'),
    [completedSubstepsByStep, issueRowsState],
  )

  useEffect(() => {
    if (adminHasDraftChanges && !(viewMode === 'workflow' && activeNav === 'assembly')) {
      setShowAdminAssemblyAlert(true)
    }
    if (viewMode === 'workflow' && activeNav === 'assembly') {
      setShowAdminAssemblyAlert(false)
    }
    if (!adminHasDraftChanges) {
      setShowAdminAssemblyAlert(false)
    }
  }, [activeNav, adminHasDraftChanges, viewMode])

  useEffect(() => {
    if (technicianHasChanges && !(viewMode === 'technician' && activeNav === 'assembly')) {
      setShowTechnicianAssemblyAlert(true)
    }
    if (viewMode === 'technician' && activeNav === 'assembly') {
      setShowTechnicianAssemblyAlert(false)
    }
    if (!technicianHasChanges) {
      setShowTechnicianAssemblyAlert(false)
    }
  }, [activeNav, technicianHasChanges, viewMode])
  const issueSummaryCardsComputed = useMemo(
    () => [
      {
        label: 'Open Issues',
        value: String(issueRowsState.filter((row) => row.status === 'Open').length),
        dot: 'error',
      },
      {
        label: 'Tech Requests',
        value: String(issueRowsState.filter((row) => row.source === 'Technician' && row.status === 'Open').length),
        dot: 'warning',
      },
      {
        label: 'System Flags',
        value: String(issueRowsState.filter((row) => row.source === 'System' && row.status === 'Open').length),
        dot: 'info',
      },
      {
        label: 'Resolved (24h)',
        value: String(issueRowsState.filter((row) => row.status === 'Resolved').length),
        dot: 'resolved',
      },
    ],
    [issueRowsState],
  )
  const currentTechnicianName = currentUser?.displayName ?? 'Technician'
  const workflowIssueRows = useMemo(
    () =>
      issueRowsState.filter((row) => {
        if (workflowIssueFilter === 'open') return row.status === 'Open'
        if (workflowIssueFilter === 'tech') return row.source === 'Technician'
        return true
      }),
    [issueRowsState, workflowIssueFilter],
  )
  const technicianIssueRows = useMemo(
    () =>
      issueRowsState.filter((row) => {
        if (technicianIssueFilter === 'open') return row.status === 'Open'
        if (technicianIssueFilter === 'mine') return row.flaggedBy === currentTechnicianName
        return true
      }),
    [currentTechnicianName, issueRowsState, technicianIssueFilter],
  )
  const technicianRequestCount = useMemo(
    () => issueRowsState.filter((row) => row.flaggedBy === currentTechnicianName).length,
    [currentTechnicianName, issueRowsState],
  )
  const myLogEntries = useMemo(
    () => [
      {
        label: 'Completed Substeps',
        value: String((completedSubstepsByStep[selectedStep.id] ?? []).length),
        meta: `${selectedStep.id} active`,
      },
      {
        label: 'Flags Submitted',
        value: String(technicianRequestCount),
        meta: 'From this account',
      },
      {
        label: 'Open Follow-ups',
        value: String(
          issueRowsState.filter((row) => row.flaggedBy === currentTechnicianName && row.status === 'Open').length,
        ),
        meta: 'Needs review',
      },
    ],
    [completedSubstepsByStep, currentTechnicianName, issueRowsState, selectedStep.id, technicianRequestCount],
  )

  const updateDraft = <K extends keyof Step>(stepId: string, key: K, value: Step[K]) => {
    setDraftsByStepId((prev) => {
      const current = prev[stepId] ?? processSteps.find((step) => step.id === stepId)
      if (!current) return prev
      return { ...prev, [stepId]: { ...current, [key]: value } }
    })
  }

  const updateDraftSubstep = (stepId: string, substepId: string, value: string) => {
    setDraftsByStepId((prev) => {
      const current = prev[stepId] ?? processSteps.find((step) => step.id === stepId)
      if (!current) return prev
      return {
        ...prev,
        [stepId]: {
          ...current,
          substeps: current.substeps.map((sub) =>
            sub.id === substepId ? { ...sub, title: value } : sub,
          ),
        },
      }
    })
  }

  const addDraftSubstep = (stepId: string) => {
    setDraftsByStepId((prev) => {
      const current = prev[stepId] ?? processSteps.find((step) => step.id === stepId)
      if (!current) return prev
      const nextIndex = current.substeps.length + 1
      const newSubstepId = `${stepId}.${nextIndex}`
      return {
        ...prev,
        [stepId]: {
          ...current,
          substeps: [...current.substeps, { id: newSubstepId, title: 'New substep' }],
        },
      }
    })
  }

  const removeDraftSubstep = (stepId: string, substepId: string) => {
    setDraftsByStepId((prev) => {
      const current = prev[stepId] ?? processSteps.find((step) => step.id === stepId)
      if (!current) return prev
      return {
        ...prev,
        [stepId]: {
          ...current,
          substeps: current.substeps.filter((sub) => sub.id !== substepId),
        },
      }
    })
  }

  const moveDraftSubstep = (stepId: string, substepId: string, direction: -1 | 1) => {
    setDraftsByStepId((prev) => {
      const current = prev[stepId] ?? processSteps.find((step) => step.id === stepId)
      if (!current) return prev
      const index = current.substeps.findIndex((sub) => sub.id === substepId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= current.substeps.length) return prev
      const reordered = [...current.substeps]
      const [item] = reordered.splice(index, 1)
      reordered.splice(targetIndex, 0, item)
      return {
        ...prev,
        [stepId]: {
          ...current,
          substeps: reordered,
        },
      }
    })
  }

  const publishDraft = (stepId: string) => {
    const draft = draftsByStepId[stepId]
    if (!draft) return
    setProcessSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...draft, isPublished: true } : step)),
    )
    setDraftsByStepId((prev) => ({
      ...prev,
      [stepId]: { ...(prev[stepId] ?? draft), isPublished: true },
    }))
    setPublishStatusMessage(`${stepId} published and now visible in technician workflow.`)
  }

  const saveDraftOnly = (stepId: string) => {
    const draft = draftsByStepId[stepId]
    if (!draft) return
    setProcessSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...draft, isPublished: step.isPublished } : step)),
    )
    setPublishStatusMessage(`${stepId} draft saved. Technician workflow unchanged until publish.`)
  }

  const unpublishStep = (stepId: string) => {
    setProcessSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, isPublished: false } : step)),
    )
    setDraftsByStepId((prev) => ({
      ...prev,
      [stepId]: prev[stepId] ? { ...prev[stepId], isPublished: false } : prev[stepId],
    }))
    setPublishStatusMessage(`${stepId} unpublished and removed from technician workflow.`)
  }

  const fetchAuthJson = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(options?.headers ?? {}),
        },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Request failed.'
        throw new Error(message)
      }
      return payload as T
    },
    [authToken],
  )

  const toUserProfile = useCallback((user: { id: string; name: string; email: string; role: string; username?: string }) => {
    const username = user.username ?? user.email.split('@')[0]
    const nameParts = user.name.split(' ').filter(Boolean)
    const displayName = nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[1].slice(0, 1)}.`
      : user.name
    const storedAvatar = readStoredAvatar(username)
    return {
      id: user.id,
      fullName: user.name,
      displayName,
      role: roleLabel(user.role),
      username,
      avatarUrl: storedAvatar || avatarForUsername(username),
      email: user.email,
    } satisfies UserProfile
  }, [])

  const loadManagedAccounts = useCallback(async () => {
    if (!authToken || currentUser?.role !== 'GripFusion Admin') return
    try {
      const data = await fetchAuthJson<{ users: ManagedAccount[] }>('/api/auth/users')
      setManagedAccounts(data.users)
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Could not load accounts.')
    }
  }, [authToken, currentUser?.role, fetchAuthJson])

  useEffect(() => {
    if (!authToken || isAuthenticated) return
    fetchAuthJson<{ user: { id: string; name: string; email: string; role: string; username?: string } }>('/api/auth/me')
      .then((data) => {
        const profile = toUserProfile(data.user)
        setCurrentUser(profile)
        setIsAuthenticated(true)
        setViewMode(profile.role === 'GripFusion Technician' ? 'technician' : 'workflow')
        setActiveNav(profile.role === 'GripFusion Technician' ? 'assembly' : 'dashboard')
      })
      .catch(() => {
        setAuthToken('')
        window.localStorage.removeItem(AUTH_TOKEN_KEY)
      })
  }, [authToken, fetchAuthJson, isAuthenticated, toUserProfile])

  useEffect(() => {
    if (!(isAuthenticated && currentUser?.role === 'GripFusion Admin' && viewMode === 'workflow' && activeNav === 'admin')) return
    loadManagedAccounts()
  }, [activeNav, currentUser?.role, isAuthenticated, loadManagedAccounts, viewMode])

  const submitDefectReport = useCallback(() => {
    const notes = defectNotes.trim()
    if (defectSeverity === 'None' && notes.length === 0) {
      setDefectSubmitMessage('Choose Minor/Reject or add notes before submitting.')
      return
    }

    const type = defectSeverity === 'Reject' ? 'ERROR' : defectSeverity === 'Minor' ? 'WARNING' : 'INFO'
    const numericIds = issueRowsState
      .map((row) => Number(row.id.replace('GF-', '')))
      .filter((num) => Number.isFinite(num))
    const nextNumericId = (numericIds.length > 0 ? Math.max(...numericIds) : 0) + 1
    const nextIssueId = `GF-${String(nextNumericId).padStart(3, '0')}`
    const description = notes.length > 0
      ? notes
      : `${selectedSubstep?.title ?? selectedStep.title} reported for review`
    const flaggedBy = currentUser?.displayName ?? 'Technician'

    setIssueRowsState((prev) => [
      {
        type,
        id: nextIssueId,
        description,
        step: selectedStep.id,
        flaggedBy,
        time: 'just now',
        status: 'Open',
        source: 'Technician',
      },
      ...prev,
    ])

    setDashboardFlagRows((prev) => [
      {
        id: `${Date.now()}-${nextIssueId}`,
        level: type,
        title: `${nextIssueId}: ${description}`,
        meta: `${flaggedBy} flagged just now.`,
      },
      ...prev,
    ])

    setDefectNotes('')
    setDefectSeverity('None')
    setDefectSubmitMessage('Defect report submitted and added to Flags & Issues.')
  }, [currentUser?.displayName, defectNotes, defectSeverity, issueRowsState, selectedStep.id, selectedStep.title, selectedSubstep?.title])

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAccountError('')
    setAccountStatus('')
    if (!accountName.trim() || !accountUsername.trim() || !accountPassword.trim()) {
      setAccountError('Name, username, and password are required.')
      return
    }
    try {
      const data = await fetchAuthJson<{ user: ManagedAccount }>('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          name: accountName.trim(),
          username: accountUsername.trim().toLowerCase(),
          password: accountPassword,
          role: accountRole,
          isActive: true,
        }),
      })
      setManagedAccounts((prev) => [data.user, ...prev])
      setAccountStatus(`Created ${data.user.username} (${data.user.role}).`)
      setAccountName('')
      setAccountUsername('')
      setAccountPassword('123')
      setAccountRole('TECHNICIAN')
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Could not create account.')
    }
  }

  const triggerProfilePhotoPick = () => profileAvatarInputRef.current?.click()

  const onProfilePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !currentUser) return
    if (!file.type.startsWith('image/')) {
      setUiActionMessage('Please upload a valid image file.')
      return
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('Could not read selected image.'))
        reader.readAsDataURL(file)
      })
      window.localStorage.setItem(avatarStorageKey(currentUser.username), dataUrl)
      setCurrentUser((prev) => (prev ? { ...prev, avatarUrl: dataUrl } : prev))
      setUiActionMessage('Profile photo updated.')
    } catch {
      setUiActionMessage('Could not update profile photo.')
    } finally {
      if (profileAvatarInputRef.current) profileAvatarInputRef.current.value = ''
    }
  }

  const showActionMessage = useCallback((message: string) => {
    setUiActionMessage(message)
  }, [])

  const startAssemblyForIdentifier = useCallback((identifier: string, shouldResetProgress: boolean) => {
    const typedIdentifier = identifier.trim()
    if (!typedIdentifier) return false
    const firstStep = activeAssemblySteps[0]
    if (!firstStep) {
      showActionMessage('No assembly steps are available for the next item.')
      return false
    }

    setCurrentBallIdentifier(typedIdentifier)
    if (shouldResetProgress) {
      setCompletedSubstepsByStep({})
    }
    setActiveStep(firstStep.id)
    setActiveSubstepByStep({
      [firstStep.id]: firstStep.substeps[0]?.id ?? '',
    })
    setTechnicianAssemblyView('catalogue')
    return true
  }, [activeAssemblySteps, showActionMessage])

  const requestItemIdentifier = useCallback((mode: 'start' | 'next') => {
    const typedIdentifier = (window.prompt('Please enter the item identifier number:', currentBallIdentifier || '') ?? '').trim()
    if (!typedIdentifier) {
      showActionMessage('Item identifier number is required before starting workflow.')
      return false
    }
    const didStart = startAssemblyForIdentifier(typedIdentifier, mode === 'next')
    if (!didStart) return false
    if (mode === 'next') {
      showActionMessage(`Started next item assembly for ball ${typedIdentifier}. Progress reset.`)
    } else {
      showActionMessage(`Assembly started for ball ${typedIdentifier}.`)
    }
    return true
  }, [currentBallIdentifier, showActionMessage, startAssemblyForIdentifier])

  const moveToNextItemAssembly = useCallback(() => {
    requestItemIdentifier('next')
  }, [requestItemIdentifier])
  const enterStepFromCatalogue = useCallback((stepId: string) => {
    if (!currentBallIdentifier.trim()) {
      const canStart = requestItemIdentifier('start')
      if (!canStart) return
    }
    selectStep(stepId)
    setTechnicianAssemblyView('expanded')
  }, [currentBallIdentifier, requestItemIdentifier, selectStep])

  const handleIssueAction = useCallback((issueId: string) => {
    setIssueRowsState((prev) =>
      prev.map((row) =>
        row.id === issueId
          ? { ...row, status: row.status === 'Open' ? 'Resolved' : 'Open' }
          : row,
      ),
    )
    showActionMessage(`Updated issue ${issueId} status.`)
  }, [showActionMessage])

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const typedUsername = loginUsername.trim().toLowerCase()
    try {
      const data = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: typedUsername,
          password: loginPassword,
        }),
      }).then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          const message = typeof payload?.error === 'string' ? payload.error : 'Invalid credentials.'
          throw new Error(message)
        }
        return payload as { token: string; user: { id: string; name: string; email: string; role: string; username?: string } }
      })

      const profile = toUserProfile(data.user)
      setIsAuthenticated(true)
      setCurrentUser(profile)
      setAuthToken(data.token)
      window.localStorage.setItem(AUTH_TOKEN_KEY, data.token)
      window.localStorage.setItem(LAST_LOGIN_USERNAME_KEY, profile.username)
      setViewMode(profile.role === 'GripFusion Technician' ? 'technician' : 'workflow')
      setActiveNav(profile.role === 'GripFusion Technician' ? 'assembly' : 'dashboard')
      if (profile.role === 'GripFusion Technician') setCurrentBallIdentifier('')
      setAuthError('')
    } catch (error) {
      const demoAccount = demoAccountByUsername[typedUsername]
      if (demoAccount && loginPassword === '123') {
        const nameParts = demoAccount.fullName.split(' ')
        const displayName = nameParts.length > 1
          ? `${nameParts[0]} ${nameParts[1].slice(0, 1)}.`
          : demoAccount.fullName
        setIsAuthenticated(true)
        setCurrentUser({
          id: `demo-${typedUsername}`,
          fullName: demoAccount.fullName,
          displayName,
          role: demoAccount.role,
          username: typedUsername,
          avatarUrl: readStoredAvatar(typedUsername) || demoAccount.avatarUrl,
          email: `${typedUsername}@gripfusion.local`,
        })
        setAuthToken('')
        window.localStorage.removeItem(AUTH_TOKEN_KEY)
        window.localStorage.setItem(LAST_LOGIN_USERNAME_KEY, typedUsername)
        setViewMode(demoAccount.role === 'GripFusion Technician' ? 'technician' : 'workflow')
        setActiveNav(demoAccount.role === 'GripFusion Technician' ? 'assembly' : 'dashboard')
        if (demoAccount.role === 'GripFusion Technician') setCurrentBallIdentifier('')
        setAuthError('')
        return
      }
      setAuthError(error instanceof Error ? error.message : 'Invalid credentials.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setCurrentUser(null)
    setAuthToken('')
    setManagedAccounts([])
    setLoginUsername('')
    setLoginPassword('')
    setAuthError('')
    setViewMode('workflow')
    setActiveNav('dashboard')
    setCurrentBallIdentifier('')
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  }

  useEffect(() => {
    if (!uiActionMessage) return
    const timeout = window.setTimeout(() => setUiActionMessage(''), 2500)
    return () => window.clearTimeout(timeout)
  }, [uiActionMessage])

  const renderNavIcon = (id: NavItem) => {
    if (id === 'dashboard') {
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
          <path
            d="M3.75 4.75h7.25v6.5H3.75v-6.5Zm9.25 0h7.25v4.5H13v-4.5Zm0 6.5h7.25v8.0H13v-8.0Zm-9.25 2h7.25v6.0H3.75v-6.0Z"
            fill="currentColor"
          />
        </svg>
      )
    }
    if (id === 'logs') {
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
          <path
            d="M5.5 3.75h9.25l3.75 3.75v12.75H5.5V3.75Zm1.5 1.5v13.5H17V8.12l-2.87-2.87H7Zm2.25 5h5.5v1.5h-5.5v-1.5Zm0 3h7.5v1.5h-7.5v-1.5Zm0-6h3.5v1.5h-3.5v-1.5Z"
            fill="currentColor"
          />
        </svg>
      )
    }
    if (id === 'admin') {
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
          <path
            d="M12 12.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5ZM5 19.25c0-2.95 2.64-5.25 7-5.25s7 2.3 7 5.25V20H5v-.75Z"
            fill="currentColor"
          />
        </svg>
      )
    }
    return navIconByItemId[id]
  }

  if (!isAuthenticated) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <img className="login-logo" src="/gripfusion-logo.png" alt="GripFusion logo" />
          <h1>GripFusion Login</h1>
          <p>Sign in to access admin or technician workflows.</p>
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={loginUsername}
              onChange={(event) => setLoginUsername(event.target.value)}
              placeholder="admin / masonf / timc / tech"
              autoComplete="username"
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="123"
              autoComplete="current-password"
            />
            {authError ? <div className="login-error">{authError}</div> : null}
            <button className="primary" type="submit">
              Sign In
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={`app ${viewMode}`}>
      {expandedAvatarUrl ? (
        <div className="avatar-modal" role="dialog" aria-modal="true" onClick={() => setExpandedAvatarUrl(null)}>
          <div className="avatar-modal-content" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="avatar-modal-close"
              onClick={() => setExpandedAvatarUrl(null)}
              aria-label="Close avatar preview"
            >
              ×
            </button>
            <img className="avatar-modal-image" src={expandedAvatarUrl} alt="Expanded profile avatar" />
          </div>
        </div>
      ) : null}

      <header className="topbar">
        <div className="brand-block">
          <div className="brand" aria-label="GripFusion">
            <img className="brand-logo" src="/gripfusion-logo.png" alt="GripFusion logo" />
            <span className="sr-only">GripFusion</span>
          </div>
        </div>
        <div className="product-tag">Force Ball V2.1</div>
        <div />
        {!isTechnicianUser ? (
          <div className="segmented">
            <button
              className={viewMode === 'workflow' ? 'active' : ''}
              onClick={() => {
                setViewMode('workflow')
                setActiveNav('dashboard')
              }}
            >
              Admin
            </button>
            <button
              className={viewMode === 'technician' ? 'active' : ''}
              onClick={() => {
                setViewMode('technician')
                setActiveNav('assembly')
              }}
            >
              Technician
            </button>
          </div>
        ) : null}
      </header>
      {uiActionMessage ? <div className="panel"><small>{uiActionMessage}</small></div> : null}

      <div className="layout">
        <aside className="sidebar">
          {viewMode === 'workflow' ? (
            <>
              <div className="nav-group">
                <div className="nav-group-title">Overview</div>
                {navItemsByView[viewMode]
                  .filter((item) => ['dashboard', 'bom'].includes(item.id))
                  .map((item) => (
                    <button
                      key={item.id}
                      className={activeNav === item.id ? 'nav-item active' : 'nav-item'}
                      onClick={() => setActiveNav(item.id)}
                    >
                      <span className="nav-item-left">
                        <span className="nav-icon">{renderNavIcon(item.id)}</span>
                        <span>{item.label}</span>
                      </span>
                      {item.id === 'assembly' && showAdminAssemblyAlert ? <span className="nav-badge">!</span> : null}
                    </button>
                  ))}
              </div>
              <div className="nav-group">
                <div className="nav-group-title">Versions</div>
                {navItemsByView[viewMode]
                  .filter((item) => ['assembly', 'testing', 'logs'].includes(item.id))
                  .map((item) => (
                    <button
                      key={item.id}
                      className={activeNav === item.id ? 'nav-item active' : 'nav-item'}
                      onClick={() => setActiveNav(item.id)}
                    >
                      <span className="nav-item-left">
                        <span className="nav-icon">{renderNavIcon(item.id)}</span>
                        <span>{item.label}</span>
                      </span>
                      {item.id === 'assembly' && showTechnicianAssemblyAlert ? <span className="nav-badge">!</span> : null}
                    </button>
                  ))}
              </div>
              <div className="nav-group">
                <div className="nav-group-title">Operations</div>
                {navItemsByView[viewMode]
                  .filter((item) => item.id === 'admin')
                  .map((item) => (
                    <button
                      key={item.id}
                      className={activeNav === item.id ? 'nav-item active' : 'nav-item'}
                      onClick={() => setActiveNav(item.id)}
                    >
                      <span className="nav-item-left">
                        <span className="nav-icon">{renderNavIcon(item.id)}</span>
                        <span>{item.label}</span>
                      </span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <>
              <div className="nav-group">
                <div className="nav-group-title">Assembly</div>
                {navItemsByView[viewMode]
                  .filter((item) => ['assembly', 'testing'].includes(item.id))
                  .map((item) => (
                    <button
                      key={item.id}
                      className={activeNav === item.id ? 'nav-item active' : 'nav-item'}
                      onClick={() => setActiveNav(item.id)}
                    >
                      <span className="nav-item-left">
                        <span className="nav-icon">{renderNavIcon(item.id)}</span>
                        <span>{item.label}</span>
                      </span>
                    </button>
                  ))}
              </div>
              <div className="nav-group">
                <div className="nav-group-title">Issues</div>
                {navItemsByView[viewMode]
                  .filter((item) => item.id === 'versions')
                  .map((item) => (
                    <button
                      key={item.id}
                      className={activeNav === item.id ? 'nav-item active' : 'nav-item'}
                      onClick={() => setActiveNav(item.id)}
                    >
                      <span className="nav-item-left">
                        <span className="nav-icon">{renderNavIcon(item.id)}</span>
                        <span>{item.label}</span>
                      </span>
                      <span className="nav-badge">3</span>
                    </button>
                  ))}
              </div>
              <div className="nav-group">
                <div className="nav-group-title">My Account</div>
                {navItemsByView[viewMode]
                  .filter((item) => ['profile', 'logs'].includes(item.id))
                  .map((item) => (
                    <button
                      key={item.id}
                      className={activeNav === item.id ? 'nav-item active' : 'nav-item'}
                      onClick={() => setActiveNav(item.id)}
                    >
                      <span className="nav-item-left">
                        <span className="nav-icon">{renderNavIcon(item.id)}</span>
                        <span>{item.label}</span>
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
          {viewMode === 'technician' ? (
            <div className="scan-panel">
              <h4>Quick Entry</h4>
              <button type="button">Scan QR</button>
              <button type="button">Scan Station Barcode</button>
              <button type="button">Enter Work Order</button>
            </div>
          ) : null}
          <div className="sidebar-footer">
            {currentUser ? (
              <div className="user-card">
                <button
                  type="button"
                  className="avatar-trigger"
                  aria-label={`Expand ${currentUser.fullName} avatar`}
                  onClick={() => setExpandedAvatarUrl(currentUser.avatarUrl)}
                >
                  <img src={currentUser.avatarUrl} alt={`${currentUser.fullName} avatar`} />
                </button>
                <div>
                  <strong>{currentUser.displayName}</strong>
                  <small>{currentUser.role}</small>
                </div>
              </div>
            ) : null}
            <div className="sidebar-actions">
              <button className="ghost sidebar-action-btn" onClick={() => setActiveNav('profile')}>
                View Profile
              </button>
              <button className="danger sidebar-action-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </aside>

        <main className="content">
          {viewMode === 'workflow' && activeNav === 'dashboard' && (
            <section className="admin-dashboard">
              <div className="admin-kpi-grid">
                <article className="admin-kpi"><h4>Units Today</h4><p>17</p><small>+2 vs yesterday</small></article>
                <article className="admin-kpi"><h4>Avg Cycle Time</h4><p>18m</p><small>Target 20m</small></article>
                <article className="admin-kpi"><h4>Pass Rate</h4><p>89%</p><small>2 reworks today</small></article>
                <article className="admin-kpi"><h4>Active Techs</h4><p>3</p><small>of 5 on shift</small></article>
              </div>
              <div className="admin-main-grid">
                <div className="panel admin-panel">
                  <div className="admin-panel-head"><h3>Open Flags</h3><button type="button" className="ghost text-link" onClick={() => setActiveNav('testing')}>View All</button></div>
                  <div className="flag-list">
                    {dashboardFlagRows.map((flag) => (
                      <div key={flag.id} className="flag-row">
                        <span className={`flag-tag ${flag.level.toLowerCase()}`}>{flag.level}</span>
                        <div className="flag-copy">
                          <strong>{flag.title}</strong>
                          <small>{flag.meta}</small>
                        </div>
                        <span className="flag-dot" />
                      </div>
                    ))}
                  </div>
                  <p className="whatif">Past 12 hours</p>
                </div>
                <div className="panel admin-panel">
                  <div className="admin-panel-head"><h3>Active Units</h3><span className="mini-icon">↗</span></div>
                  <div className="unit-list">
                    {dashboardUnits.map((unit) => (
                      <div key={unit.name} className="unit-row">
                        <span>{unit.name}</span>
                        <div className="progress-track"><div className="progress-fill" style={{ width: `${unit.progress}%` }} /></div>
                      </div>
                    ))}
                  </div>
                  <p className="whatif">Past 12 hours</p>
                </div>
                <div className="panel admin-panel placeholder-panel">
                  <h3>Throughput Rate</h3>
                  <div className="throughput-chart">
                    <svg className="throughput-chart-svg" viewBox="0 0 500 140" preserveAspectRatio="none" aria-hidden="true">
                      {throughputGridLines.map((line, index) => (
                        <line
                          key={`grid-${index}`}
                          x1="0"
                          y1={line.y}
                          x2={throughputChartWidth}
                          y2={line.y}
                          stroke="rgba(0,0,0,0.06)"
                          strokeWidth="1"
                        />
                      ))}
                      <line
                        x1="0"
                        y1={throughputChartBaseY - (throughputTarget / throughputMaxY) * (throughputChartBaseY - throughputPlotMinY)}
                        x2={throughputChartWidth}
                        y2={throughputChartBaseY - (throughputTarget / throughputMaxY) * (throughputChartBaseY - throughputPlotMinY)}
                        stroke="#bababa"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                      <polygon points={throughputAreaPoints} className="throughput-area-path" />
                      <polyline points={throughputLinePoints} className="throughput-line-path" />
                      <circle
                        cx={throughputPoints[throughputPoints.length - 1]?.x ?? throughputChartWidth}
                        cy={throughputPoints[throughputPoints.length - 1]?.y ?? throughputChartBaseY}
                        r="3.5"
                        className="throughput-dot"
                      />
                    </svg>
                  </div>
                  <div className="throughput-stats">
                    <div><strong>{throughputCurrent.toFixed(1)}</strong><small>Current u/hr</small></div>
                    <div><strong>{throughputAvg.toFixed(1)}</strong><small>Avg u/hr</small></div>
                    <div><strong>+{throughputVsYesterday}%</strong><small>vs yesterday</small></div>
                    <div><strong>17</strong><small>Units today</small></div>
                  </div>
                </div>
                <div className="panel admin-panel placeholder-panel">
                  <h3>Technician Output</h3>
                  <div className="technician-bar-chart">
                    {technicianOutput.map((tech) => (
                      <div key={tech.name} className="tech-bar-column">
                        <small>{tech.tasks}</small>
                        <div className="tech-bar-track">
                          <div
                            className="tech-bar-fill"
                            style={{ height: `${(tech.tasks / maxTechnicianOutput) * 100}%` }}
                          />
                        </div>
                        <span>{tech.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="tech-leaderboard">
                    {technicianLeaderboard.map((tech) => (
                      <div key={tech.rank} className="tech-leaderboard-row">
                        <span className="tech-rank-pill">{tech.rank}</span>
                        <strong>{tech.name}</strong>
                        <span className="tech-units-copy">
                          {tech.units} units
                          {tech.warning > 0 ? ` ${tech.warning} rework` : ''}
                        </span>
                        <div className="tech-leader-track">
                          <div className="tech-leader-fill" style={{ width: `${tech.progress}%` }} />
                          {tech.warning > 0 ? <div className="tech-leader-warning" style={{ width: `${tech.warning}%` }} /> : null}
                        </div>
                        <span className={`tech-leader-tag ${tech.tag.toLowerCase()}`}>{tech.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {viewMode === 'technician' && activeNav === 'assembly' && (
            <section className="technician-assembly-shell">
              <div className="technician-assembly-top">
                <div>
                  <h2>Force Ball V2.1 - Assembly Manual</h2>
                  <small>{activeAssemblySteps.length} modules · Step {progressStepIndex + 1} in progress · Unit {currentBallIdentifier || 'Not started'}</small>
                </div>
                <div className="technician-assembly-top-actions">
                  {assemblyProgressPercent >= 100 ? (
                    <button
                      type="button"
                      className="primary"
                      onClick={moveToNextItemAssembly}
                    >
                      Move to Next Item Assembly
                    </button>
                  ) : null}
                  {technicianAssemblyView === 'expanded' ? (
                    <button
                      type="button"
                      className="ghost technician-home-btn"
                      onClick={() => setTechnicianAssemblyView('catalogue')}
                    >
                      Return to Home Page
                    </button>
                  ) : null}
                </div>
              </div>

              {technicianAssemblyView === 'expanded' ? (
                <div className="tech-expanded-layout">
                  <div className="tech-expanded-main">
                    <div className="tech-expanded-image">
                      <div className="tech-reference-progress">
                        <div className="tech-reference-progress-fill" style={{ width: `${assemblyProgressPercent}%` }} />
                      </div>
                      <div className="tech-reference-stage">
                        {expandedAssemblyImage ? (
                          <img className="tech-expanded-guide-image" src={expandedAssemblyImage.url} alt={expandedAssemblyImage.name} />
                        ) : (
                          <div className="tech-reference-fallback">
                            <img
                              className="tech-expanded-guide-image"
                              src={referencePlaceholderImage}
                              alt="Step reference placeholder"
                            />
                          </div>
                        )}
                      </div>
                      <div className="tech-reference-carousel" onClick={(event) => event.stopPropagation()}>
                        {(expandedAssemblyImages.length > 0 ? expandedAssemblyImages : [{ id: 'fallback-dot' }]).map((image, index) => (
                          <button
                            key={image.id}
                            type="button"
                            className={index === resolvedExpandedAssemblyImageIndex ? 'carousel-dot active' : 'carousel-dot'}
                            aria-label={`View reference image ${index + 1}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              setExpandedAssemblyImageIndex(index)
                            }}
                            disabled={expandedAssemblyImages.length === 0}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="tech-expanded-footer">
                      <div>
                        <h3>{selectedSubstep?.title ?? `Step ${selectedSubstepId || selectedStep.id}`} </h3>
                        <p>
                          {selectedStep.title} - Substep {selectedSubstepNumber} of {Math.max(1, selectedStep.substeps.length)}. {selectedStep.instruction}
                        </p>
                      </div>
                      <div className="tech-expanded-actions">
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => navigateAssembly(-1)}
                          disabled={!canGoBackInAssembly}
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={markCurrentSubstepIncomplete}
                          disabled={!isCurrentSubstepCompleted}
                        >
                          Mark Incomplete
                        </button>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => {
                            if (isCurrentSubstepCompleted) {
                              navigateAssembly(1, { allowStepTransition: true })
                              return
                            }
                            markCurrentSubstepComplete()
                          }}
                          disabled={!selectedSubstepId || (isCurrentSubstepCompleted ? !canContinueInAssembly : false)}
                        >
                          {isCurrentSubstepCompleted
                            ? (isAtLastSubstepInStep && nextStepInAssembly
                              ? `Move on to Step ${nextStepInAssembly.id}`
                              : 'Next Step')
                            : 'Mark Complete'}
                        </button>
                        <button
                          type="button"
                          className="tech-flag-btn"
                          aria-label="Flag issue"
                          onClick={() => showActionMessage('Flag shortcut opened. Use Submit Defect Report to log details.')}
                        >
                          ⚑
                        </button>
                      </div>
                    </div>
                  </div>

                  <aside className="tech-expanded-side">
                    <div className="tech-side-panel">
                      <h4>Substeps</h4>
                      <div className="tech-side-step-list">
                        {selectedStep.substeps.map((sub, index) => {
                          const isActiveSubstep = sub.id === selectedSubstepId
                          const isDoneSubstep = isSubstepCompleted(selectedStep.id, sub.id)
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              className={isActiveSubstep ? 'tech-side-step active' : 'tech-side-step'}
                              onClick={() => selectSubstep(selectedStep.id, sub.id)}
                            >
                              <span className={`tech-step-state ${isDoneSubstep ? 'done' : isActiveSubstep ? 'in-progress' : 'pending'}`}>
                                {isDoneSubstep ? '✓' : index + 1}
                              </span>
                              <span>{sub.title}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="tech-side-panel">
                      <h4>Report Defects</h4>
                      <div className="defect-options">
                        <label><input type="radio" name="defect" checked={defectSeverity === 'None'} onChange={() => setDefectSeverity('None')} /> None</label>
                        <label><input type="radio" name="defect" checked={defectSeverity === 'Minor'} onChange={() => setDefectSeverity('Minor')} /> Minor</label>
                        <label><input type="radio" name="defect" checked={defectSeverity === 'Reject'} onChange={() => setDefectSeverity('Reject')} /> Reject</label>
                      </div>
                      <textarea
                        rows={4}
                        placeholder="Add notes..."
                        value={defectNotes}
                        onChange={(event) => setDefectNotes(event.target.value)}
                      />
                      <button type="button" className="primary" onClick={submitDefectReport}>Submit Defect Report</button>
                      {defectSubmitMessage ? <small>{defectSubmitMessage}</small> : null}
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="tech-catalogue-layout">
                  <div className="tech-catalogue-progress">
                    <div className="tech-catalogue-progress-track">
                      <div className="tech-catalogue-progress-fill" style={{ width: `${assemblyProgressPercent}%` }} />
                    </div>
                    <span>{assemblyProgressPercent}% complete</span>
                  </div>
                  <div className="tech-cards-grid">
                    {activeAssemblySteps.map((step, index) => {
                      const isDone = isStepCompleted(step)
                      const isActive = !isDone && index === progressStepIndex
                      const stepSubstepImages = step.substeps
                        .map((substep) => guidingImageBySubstepId[substep.id])
                        .filter((image): image is string => Boolean(image))
                      const primaryCardImages = stepSubstepImages.length > 0
                        ? stepSubstepImages.slice(0, 3)
                        : guidingImageByStepId[step.id]
                          ? [guidingImageByStepId[step.id]]
                          : []
                      const cardImages = [...primaryCardImages]
                      while (cardImages.length < 3) {
                        cardImages.push(referencePlaceholderImage)
                      }
                      const cardImageRemainder = Math.max(0, stepSubstepImages.length - primaryCardImages.length)
                      return (
                        <article
                          key={step.id}
                          className={`tech-step-card ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => enterStepFromCatalogue(step.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              enterStepFromCatalogue(step.id)
                            }
                          }}
                        >
                          <div className="tech-card-head">
                            <span>{isDone ? 'Completed' : isActive ? 'In Progress' : 'Pending'}</span>
                            <strong>{isDone ? '✓' : index + 1}</strong>
                          </div>
                          <div className="tech-card-image">
                            <div className="tech-card-image-strip multi">
                              {cardImages.map((imageUrl, imageIndex) => (
                                <img
                                  key={`${step.id}-preview-${imageIndex}`}
                                  src={imageUrl}
                                  alt={`${step.id} preview ${imageIndex + 1}`}
                                />
                              ))}
                              {cardImageRemainder > 0 ? <span className="tech-card-image-more">+{cardImageRemainder}</span> : null}
                            </div>
                          </div>
                          <small className="tech-step-id-label">{step.id}</small>
                          <h4>{step.title}</h4>
                          <p>{step.instruction}</p>
                          <ul className="tech-card-checklist">
                            {step.substeps.slice(0, 3).map((sub) => (
                              <li key={sub.id}>
                                <span className={`tech-check-icon ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                                  {isDone ? '✓' : isActive ? '•' : '○'}
                                </span>
                                <span>{sub.title}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="tech-card-footer">
                            <small>{isActive ? '1m 30s elapsed' : isDone ? 'Done' : 'Locked'}</small>
                            <button
                              type="button"
                              className={isActive ? 'primary' : 'ghost'}
                              onClick={(event) => {
                                event.stopPropagation()
                                enterStepFromCatalogue(step.id)
                              }}
                            >
                              {isActive ? 'Continue →' : isDone ? 'View →' : 'Preview →'}
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {viewMode === 'technician' && activeNav === 'testing' && (
            <section>
              <div className="screen-header">
                <h2>Testing & QA</h2>
                <div className="chips">
                  <span>Serial: GF-2A-99512</span>
                  <span>HW V2.1 / FW 1.9.7</span>
                </div>
              </div>
              <div className="two-col">
                <div className="panel">
                  <h3>Sequential Test Workflow</h3>
                  <ol>
                    <li>Connect force ball to fixture and open Test Runner.</li>
                    <li>Calibrate neutral force baseline and verify UI screenshot match.</li>
                    <li>Run impact simulation script and capture peak force metrics.</li>
                    <li>Submit pass/fail with operator signature.</li>
                  </ol>
                  <div className="actions">
                    <button type="button" className="primary" onClick={() => showActionMessage('PASS result recorded (placeholder).')}>Mark PASS</button>
                    <button type="button" className="danger" onClick={() => showActionMessage('FAIL result recorded (placeholder).')}>Mark FAIL</button>
                  </div>
                </div>
                <div className="panel">
                  <h3>Recent Defect Analytics</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Defect Type</th>
                        <th>Step</th>
                        <th>Shift</th>
                        <th>Supplier</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Harness pinch</td><td>S16</td><td>Night</td><td>Internal</td><td>2.8%</td></tr>
                      <tr><td>Sensor drift</td><td>S07</td><td>Day</td><td>NexSense</td><td>1.9%</td></tr>
                      <tr><td>Battery mount slack</td><td>S12</td><td>Swing</td><td>Lumicell</td><td>1.3%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {viewMode === 'workflow' && activeNav === 'bom' && (
            <section className="bom-page">
              <div className="screen-header">
                <h2>BOM & Cost Explorer</h2>
                <button type="button" className="primary" onClick={onBomImportPick}>
                  Upload Excel
                </button>
                <input
                  ref={bomImportInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0]
                    if (!selectedFile) return
                    importBomFromFile(selectedFile)
                    if (bomImportInputRef.current) bomImportInputRef.current.value = ''
                  }}
                />
              </div>
              <div className="panel bom-scenario-panel">
                <label>Scenario Volume: {volume.toLocaleString()} units</label>
                <input
                  type="range"
                  min={1000}
                  max={10000}
                  step={500}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                />
                <p className="whatif">
                  What-if result: projected unit cost <strong>${unitCost}</strong> at this volume.
                </p>
                <div className="bom-scenario-total">
                  <small>Final Scenario Total</small>
                  <strong>${bomScenarioTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </div>
                {bomImportError ? <p className="login-error">{bomImportError}</p> : null}
              </div>
              <div className="panel bom-table-panel">
                <table className="bom-wide-table">
                  <thead>
                    <tr>
                      <th>Item #</th>
                      <th>Part Name</th>
                      <th>Drawing #</th>
                      <th>JVIS Part #</th>
                      <th>Customer Part #</th>
                      <th>Qty</th>
                      <th>Material</th>
                      <th>Supplier</th>
                      <th>Mfg Process</th>
                      <th>Color</th>
                      <th>Finish</th>
                      <th>Dimensions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomRows.map((row) => (
                      <tr key={`${row.itemNo}-${row.partName}`}>
                        <td>{row.itemNo}</td>
                        <td>{row.partName}</td>
                        <td>{row.drawingNumber}</td>
                        <td>{row.jviPartNo}</td>
                        <td>{row.customerPartNo}</td>
                        <td>{row.qty}</td>
                        <td>{row.material}</td>
                        <td>{row.supplier}</td>
                        <td>{row.mfgProcess}</td>
                        <td>{row.color}</td>
                        <td>{row.finish}</td>
                        <td>{row.dimensions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {viewMode === 'technician' && activeNav === 'versions' && (
            <section className="issues-page">
              <div className="screen-header">
                <h2>Flags & Issues</h2>
                <div className="issues-toolbar">
                  <button type="button" className={technicianIssueFilter === 'all' ? 'issues-filter-btn active' : 'issues-filter-btn'} onClick={() => setTechnicianIssueFilter('all')}>All</button>
                  <button type="button" className={technicianIssueFilter === 'open' ? 'issues-filter-btn active' : 'issues-filter-btn'} onClick={() => setTechnicianIssueFilter('open')}>Open</button>
                  <button type="button" className={technicianIssueFilter === 'mine' ? 'issues-filter-btn active' : 'issues-filter-btn'} onClick={() => setTechnicianIssueFilter('mine')}>My Requests</button>
                </div>
              </div>
              <div className="issues-summary-grid">
                {issueSummaryCardsComputed.map((card) => (
                  <article key={card.label} className="issues-summary-card">
                    <span className={`issues-dot ${card.dot}`} />
                    <div>
                      <strong>{card.value}</strong>
                      <small>{card.label}</small>
                    </div>
                  </article>
                ))}
              </div>
              <div className="panel tech-request-panel">
                <div className="issues-table-head">
                  <h3>Requests Raised by Technicians</h3>
                  <span className="issue-step-pill">{technicianRequestCount} submitted</span>
                </div>
                <p className="keyboard-hint">This queue includes requests created directly by technicians, including your own submissions.</p>
              </div>
              <div className="panel issues-table-panel">
                <div className="issues-table-wrap">
                  <table className="issues-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>ID</th>
                        <th>Description</th>
                        <th>Step</th>
                        <th>Requested By</th>
                        <th>Source</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {technicianIssueRows.map((row) => (
                        <tr key={row.id}>
                          <td><span className={`flag-tag ${row.type.toLowerCase()}`}>{row.type}</span></td>
                          <td>{row.id}</td>
                          <td>{row.description}</td>
                          <td><span className="issue-step-pill">{row.step}</span></td>
                          <td>{row.flaggedBy}</td>
                          <td><span className="issue-step-pill">{row.source}</span></td>
                          <td><span className={`issue-status ${row.status.toLowerCase()}`}>{row.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {viewMode === 'technician' && activeNav === 'logs' && (
            <section className="tech-log-page">
              <div className="screen-header">
                <h2>My Log</h2>
                <button type="button" className="primary" onClick={() => showActionMessage('Log exported (placeholder).')}>Export My Shift Log</button>
              </div>
              <div className="tech-log-kpis">
                {myLogEntries.map((entry) => (
                  <article key={entry.label} className="issues-summary-card">
                    <span className="issues-dot info" />
                    <div>
                      <strong>{entry.value}</strong>
                      <small>{entry.label}</small>
                      <p className="keyboard-hint">{entry.meta}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="panel issues-table-panel">
                <div className="issues-table-head">
                  <h3>My Activity Feed</h3>
                </div>
                <div className="issues-table-wrap">
                  <table className="issues-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Reference</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issueRowsState
                        .filter((row) => row.flaggedBy === currentTechnicianName)
                        .map((row) => (
                          <tr key={`log-${row.id}`}>
                            <td>{row.time}</td>
                            <td>Issue Request Submitted</td>
                            <td>{row.id} · {row.step}</td>
                            <td><span className={`issue-status ${row.status.toLowerCase()}`}>{row.status}</span></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {viewMode === 'workflow' && activeNav === 'logs' && (
            <section className="panel">
              <h2>Data & Logs Repository</h2>
              <p>
                Centralized relational data model: components, suppliers, builds, test runs, failures,
                customers, and refurb batches. All records map to product + HW/FW versions with role-based
                access and full audit history.
              </p>
              <div className="chart-placeholder">Repository Schema + Sync Status</div>
            </section>
          )}

          {viewMode === 'workflow' && activeNav === 'assembly' && (
            <section className="panel manual-edits-page">
              <h2>Manual Edits</h2>
              <p>Admin drafts process updates and publishes live changes to technician-facing assembly steps.</p>
              <div className="manual-edit-actions">
                <button type="button" className="primary" onClick={onProcessImportPick}>
                  Import Process Excel
                </button>
                <input
                  ref={processImportInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0]
                    if (!selectedFile) return
                    importProcessFromFile(selectedFile)
                    if (processImportInputRef.current) processImportInputRef.current.value = ''
                  }}
                />
                {processImportStatus ? <small>{processImportStatus}</small> : null}
              </div>
              {processImportError ? <p className="login-error">{processImportError}</p> : null}
              {selectedEditStep && selectedDraft ? (
                <div className="manual-edits-layout manual-work-layout">
                  <div className="manual-work-main">
                    <div className="manual-step-list">
                      {processSteps.map((step) => (
                        <button
                          key={step.id}
                          type="button"
                          className={selectedEditStepId === step.id ? 'manual-step-row active' : 'manual-step-row'}
                          onClick={() => setSelectedEditStepId(step.id)}
                        >
                          <span>{step.id} · {step.title}</span>
                          <small>{step.isPublished ? 'Published' : 'Unpublished'}</small>
                        </button>
                      ))}
                    </div>

                    <div
                      className="manual-work-image image-dropzone"
                      role="button"
                      tabIndex={0}
                      aria-label="Upload manual step photo"
                      onClick={onAdminPick}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onAdminPick()
                      }}
                    >
                      <input
                        ref={adminImageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? [])
                          addAdminImageForStep(selectedEditStep.id, files)
                          if (adminImageInputRef.current) adminImageInputRef.current.value = ''
                        }}
                      />
                      {selectedAdminImage ? (
                        <img
                          className="manual-work-guide-image"
                          src={selectedAdminImage.url}
                          alt={selectedAdminImage.name}
                        />
                      ) : guidingImageByStepId[selectedEditStep.id] ? (
                        <img
                          className="manual-work-guide-image"
                          src={guidingImageByStepId[selectedEditStep.id]}
                          alt={`Guiding image for ${selectedEditStep.id}`}
                        />
                      ) : (
                        <div className="manual-reference-placeholder">
                          <div className="manual-reference-progress">
                            <div
                              className="manual-reference-progress-fill"
                              style={{ width: `${manualEditProgressPercent}%` }}
                            />
                          </div>
                          <img
                            className="manual-work-guide-image"
                            src={referencePlaceholderImage}
                            alt="Step reference placeholder"
                          />
                          <div className="manual-reference-carousel">
                            <span className="manual-carousel-dot active" />
                            <span className="manual-carousel-dot" />
                            <span className="manual-carousel-dot" />
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedAdminImageList.length > 0 ? (
                      <div className="manual-image-strip-wrap">
                        <div className="manual-image-strip">
                          {selectedAdminImageList.map((image, index) => (
                            <button
                              key={image.id}
                              type="button"
                              className={index === selectedAdminImageIndex ? 'manual-image-thumb active' : 'manual-image-thumb'}
                              onClick={() =>
                                setSelectedAdminImageIndexByStepId((prev) => ({
                                  ...prev,
                                  [selectedEditStep.id]: index,
                                }))
                              }
                            >
                              <img src={image.url} alt={image.name} />
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="danger manual-remove-image-btn"
                          onClick={() => {
                            if (!selectedAdminImage) return
                            removeAdminImageForStep(selectedEditStep.id, selectedAdminImage.id)
                          }}
                          disabled={!selectedAdminImage}
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : null}

                    <div className="manual-work-footer">
                      <label>
                        Step title
                        <input
                          value={selectedDraft.title}
                          onChange={(e) => updateDraft(selectedEditStep.id, 'title', e.target.value)}
                        />
                      </label>
                      <label>
                        Step description
                        <textarea
                          rows={3}
                          value={selectedDraft.instruction}
                          onChange={(e) => updateDraft(selectedEditStep.id, 'instruction', e.target.value)}
                        />
                      </label>
                      <div className="manual-work-footer-actions">
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            if (!selectedAdminImage) return
                            removeAdminImageForStep(selectedEditStep.id, selectedAdminImage.id)
                          }}
                          disabled={!selectedAdminImage}
                        >
                          Remove Selected Image
                        </button>
                      </div>
                    </div>
                  </div>

                  <aside className="manual-work-side">
                    <div className="manual-side-panel">
                      <h4>Edit Metadata</h4>
                      <small className="manual-side-hint">Update core step properties used by technicians.</small>
                      <div className="manual-edit-form">
                        <label>
                          Tools (comma separated)
                          <input
                            value={selectedDraft.tools.join(', ')}
                            onChange={(e) => updateDraft(selectedEditStep.id, 'tools', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
                          />
                        </label>
                        <label>
                          Materials (comma separated)
                          <input
                            value={selectedDraft.materials.join(', ')}
                            onChange={(e) => updateDraft(selectedEditStep.id, 'materials', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
                          />
                        </label>
                        <label>
                          Critical
                          <input
                            value={selectedDraft.critical}
                            onChange={(e) => updateDraft(selectedEditStep.id, 'critical', e.target.value)}
                          />
                        </label>
                        <label>
                          Version note
                          <input
                            value={selectedDraft.versionNote}
                            onChange={(e) => updateDraft(selectedEditStep.id, 'versionNote', e.target.value)}
                          />
                        </label>
                        <label>
                          FMEA
                          <textarea
                            rows={2}
                            value={selectedDraft.fmea}
                            onChange={(e) => updateDraft(selectedEditStep.id, 'fmea', e.target.value)}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="manual-side-panel">
                      <div className="manual-substeps-head">
                        <h4>Substeps</h4>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => addDraftSubstep(selectedEditStep.id)}
                        >
                          + Add Substep
                        </button>
                      </div>
                      <small className="manual-side-hint">Keep substeps short and action-oriented for the technician panel.</small>
                      <div className="manual-substeps-list">
                        {selectedDraft.substeps.map((sub, index) => (
                          <div key={sub.id} className="manual-substep-row">
                            <span className="manual-substep-id">{sub.id}</span>
                            <input
                              value={sub.title}
                              onChange={(e) => updateDraftSubstep(selectedEditStep.id, sub.id, e.target.value)}
                            />
                            <div className="manual-substep-actions">
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => moveDraftSubstep(selectedEditStep.id, sub.id, -1)}
                                disabled={index === 0}
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => moveDraftSubstep(selectedEditStep.id, sub.id, 1)}
                                disabled={index === selectedDraft.substeps.length - 1}
                              >
                                Down
                              </button>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => removeDraftSubstep(selectedEditStep.id, sub.id)}
                                disabled={selectedDraft.substeps.length <= 1}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="manual-side-panel">
                      <h4>Publish Controls</h4>
                      <small className="manual-side-hint">Draft changes stay internal until Publish Live is used.</small>
                      <div className="manual-edit-actions">
                        <button type="button" className="ghost" onClick={() => saveDraftOnly(selectedEditStep.id)}>
                          Save Draft
                        </button>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => publishDraft(selectedEditStep.id)}
                          disabled={selectedEditStep.isPublished}
                        >
                          Publish Live
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => unpublishStep(selectedEditStep.id)}
                          disabled={!selectedEditStep.isPublished}
                        >
                          Unpublish
                        </button>
                      </div>
                      {publishStatusMessage ? <small className="manual-publish-status">{publishStatusMessage}</small> : null}
                    </div>
                  </aside>
                </div>
              ) : null}
            </section>
          )}

          {viewMode === 'workflow' && activeNav === 'testing' && (
            <section className="issues-page">
              <div className="screen-header">
                <h2>Flags & Issues</h2>
                <div className="issues-toolbar">
                  <button type="button" className={workflowIssueFilter === 'all' ? 'issues-filter-btn active' : 'issues-filter-btn'} onClick={() => setWorkflowIssueFilter('all')}>All</button>
                  <button type="button" className={workflowIssueFilter === 'open' ? 'issues-filter-btn active' : 'issues-filter-btn'} onClick={() => setWorkflowIssueFilter('open')}>Open</button>
                  <button type="button" className={workflowIssueFilter === 'tech' ? 'issues-filter-btn active' : 'issues-filter-btn'} onClick={() => setWorkflowIssueFilter('tech')}>Technician Requests</button>
                </div>
              </div>
              <div className="issues-toolbar">
                <button type="button" className="primary" onClick={() => showActionMessage('Create Flag flow placeholder opened.')}>+ Flag Issue</button>
              </div>
              <div className="issues-summary-grid">
                {issueSummaryCardsComputed.map((card) => (
                  <article key={card.label} className="issues-summary-card">
                    <span className={`issues-dot ${card.dot}`} />
                    <div>
                      <strong>{card.value}</strong>
                      <small>{card.label}</small>
                    </div>
                  </article>
                ))}
              </div>
              <div className="panel tech-request-panel">
                <div className="issues-table-head">
                  <h3>Requests from Technicians</h3>
                  <span className="issue-step-pill">
                    {issueRowsState.filter((row) => row.source === 'Technician' && row.status === 'Open').length} open
                  </span>
                </div>
                <p className="keyboard-hint">Prioritize these requests to close the feedback loop from the floor quickly.</p>
              </div>
              <div className="panel issues-table-panel">
                <div className="issues-table-head">
                  <h3>All Flags</h3>
                  <button type="button" className="issues-sort-btn" onClick={() => showActionMessage('Sort toggle placeholder used.')}>Sort: Newest</button>
                </div>
                <div className="issues-table-wrap">
                  <table className="issues-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>ID</th>
                        <th>Description</th>
                        <th>Step</th>
                        <th>Flagged By</th>
                        <th>Source</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workflowIssueRows.map((row) => (
                        <tr key={row.id}>
                          <td><span className={`flag-tag ${row.type.toLowerCase()}`}>{row.type}</span></td>
                          <td>{row.id}</td>
                          <td>{row.description}</td>
                          <td><span className="issue-step-pill">{row.step}</span></td>
                          <td>{row.flaggedBy}</td>
                          <td><span className="issue-step-pill">{row.source}</span></td>
                          <td>{row.time}</td>
                          <td><span className={`issue-status ${row.status.toLowerCase()}`}>{row.status}</span></td>
                          <td>
                            <button type="button" className="issues-action-btn" onClick={() => handleIssueAction(row.id)}>
                              {row.status === 'Open' ? 'Resolve' : 'View'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {viewMode === 'workflow' && activeNav === 'admin' && (
            <section className="admin-control-page">
              <div className="admin-control-topbar">
                <h2>Admin Panel</h2>
                <div className="admin-control-actions">
                  <button type="button" className="issues-filter-btn" onClick={() => showActionMessage('System Settings placeholder opened.')}>System Settings</button>
                </div>
              </div>
              <div className="admin-control-kpis">
                {adminPanelKpis.map((kpi) => (
                  <article key={kpi.label} className={`admin-control-kpi ${kpi.accent}`}>
                    <small>{kpi.label}</small>
                    <strong>{kpi.value}</strong>
                  </article>
                ))}
              </div>
              <div className="admin-control-grid">
                <div className="panel admin-control-products">
                  <div className="admin-panel-head">
                    <h3>Bill of Materials</h3>
                  </div>
                  <table className="admin-control-table bom-wide-table">
                    <thead>
                      <tr>
                        <th>Item #</th>
                        <th>Part Name</th>
                        <th>Drawing #</th>
                        <th>JVIS Part #</th>
                        <th>Customer Part #</th>
                        <th>Qty</th>
                        <th>Material</th>
                        <th>Supplier</th>
                        <th>Mfg Process</th>
                        <th>Color</th>
                        <th>Finish</th>
                        <th>Dimensions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomRows.map((row) => (
                        <tr key={`${row.itemNo}-${row.partName}`}>
                          <td>{row.itemNo}</td>
                          <td>{row.partName}</td>
                          <td>{row.drawingNumber}</td>
                          <td>{row.jviPartNo}</td>
                          <td>{row.customerPartNo}</td>
                          <td>{row.qty}</td>
                          <td>{row.material}</td>
                          <td>{row.supplier}</td>
                          <td>{row.mfgProcess}</td>
                          <td>{row.color}</td>
                          <td>{row.finish}</td>
                          <td>{row.dimensions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="admin-control-side">
                  <div className="panel admin-control-techs">
                    <div className="admin-panel-head">
                      <h3>Active Technicians</h3>
                      <span className="issue-step-pill">3 on shift</span>
                    </div>
                    <div className="admin-tech-grid">
                      {activeTechnicians.map((tech) => (
                        <article key={tech.initials} className={`admin-tech-card ${tech.state === 'Offline' ? 'offline' : ''}`}>
                          <div className="admin-tech-avatar">{tech.initials}</div>
                          <strong>{tech.name}</strong>
                          <small>{tech.output}</small>
                          <span className={`admin-tech-state ${tech.state.toLowerCase()}`}>{tech.state}</span>
                        </article>
                      ))}
                    </div>
                  </div>
                  <div className="panel admin-control-alerts">
                    <h3>System Alerts</h3>
                    <div className="admin-alert-list">
                      {systemAlerts.map((alert) => (
                        <div key={alert.text} className="admin-alert-row">
                          <span className={`flag-tag ${alert.level.toLowerCase()}`}>{alert.level}</span>
                          <div>
                            <strong>{alert.text}</strong>
                            <small>{alert.meta}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="panel admin-control-alerts">
                    <h3>Add Accounts</h3>
                    <form className="manual-edit-form" onSubmit={handleCreateAccount}>
                      <label>
                        Full name
                        <input
                          value={accountName}
                          onChange={(event) => setAccountName(event.target.value)}
                          placeholder="Technician User"
                        />
                      </label>
                      <label>
                        Username
                        <input
                          value={accountUsername}
                          onChange={(event) => setAccountUsername(event.target.value)}
                          placeholder="tech2"
                        />
                      </label>
                      <label>
                        Password
                        <input
                          type="password"
                          value={accountPassword}
                          onChange={(event) => setAccountPassword(event.target.value)}
                          placeholder="123"
                        />
                      </label>
                      <label>
                        Role
                        <select
                          value={accountRole}
                          onChange={(event) => setAccountRole(event.target.value as 'ADMIN' | 'TECHNICIAN')}
                        >
                          <option value="TECHNICIAN">Technician</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </label>
                      <button type="submit" className="primary">Create Account</button>
                      {accountError ? <small className="login-error">{accountError}</small> : null}
                      {accountStatus ? <small>{accountStatus}</small> : null}
                    </form>
                    <div className="admin-alert-list">
                      {managedAccounts.slice(0, 8).map((account) => (
                        <div key={account.id} className="admin-alert-row">
                          <span className={`flag-tag ${account.role === 'ADMIN' ? 'warning' : 'resolved'}`}>
                            {account.role === 'ADMIN' ? 'ADMIN' : 'TECH'}
                          </span>
                          <div>
                            <strong>{account.name}</strong>
                            <small>{account.username} · {account.isActive ? 'Active' : 'Inactive'}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeNav === 'profile' && (
            <section className="panel profile-page">
              <h2>Profile</h2>
              {currentUser ? (
                <>
                  <button
                    type="button"
                    className="profile-avatar-trigger"
                    aria-label={`Expand ${currentUser.fullName} avatar`}
                    onClick={() => setExpandedAvatarUrl(currentUser.avatarUrl)}
                  >
                    <img className="profile-avatar" src={currentUser.avatarUrl} alt={`${currentUser.fullName} avatar`} />
                  </button>
                  <div className="manual-edit-actions">
                    <button type="button" className="primary" onClick={triggerProfilePhotoPick}>
                      Upload Photo
                    </button>
                    <input
                      ref={profileAvatarInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={onProfilePhotoSelected}
                    />
                  </div>
                  <p><strong>Name:</strong> {currentUser.fullName}</p>
                  <p><strong>Display name:</strong> {currentUser.displayName}</p>
                  <p><strong>Role:</strong> {currentUser.role}</p>
                  <p><strong>Username:</strong> {currentUser.username}</p>
                </>
              ) : (
                <p>No active user profile.</p>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
