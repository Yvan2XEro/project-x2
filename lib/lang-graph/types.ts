import type { User } from "@/lib/db/schema";
import type { AgentTimelineStatus, ChatMessage } from "@/lib/types";

export type AgentIdentifier =
  | "prompt_enhancer"
  | "lead_manager"
  | "data_source_manager"
  | "data_connector"
  | "data_searcher"
  | "expert_input"
  | "data_analyzer"
  | "data_presenter"
  | "render_packager"
  | "reviewer";

export type FrameworkComponent = {
  component: string;
  description: string;
  required_data: string[];
  analysis_approach: string;
};

export type SmartRequirements = {
  specific: string[];
  measurable: string[];
  attainable: string[];
  relevant: string[];
  time_bound: string[];
};

export type OutputStructureSection = {
  section_title: string;
  section_order: number;
  components_included: string[];
  content_requirements: string;
};

export type OutputStructure = {
  sections: OutputStructureSection[];
  grouping_logic: string;
};

export type EnhancedPrompt = {
  triageResult: {
    sector: string;
    function: string;
    category: string;
    confidenceScore: number;
  };
  geographic_reference?: string;
  timeframe?: string;
  specific_factors_mentioned?: string[];
  analysis_type: string;
  recommended_framework: string;
  framework_components: FrameworkComponent[];
  smart_requirements: SmartRequirements;
  output_structure: OutputStructure;
  enhanced_prompt: string;
};

export type ExecutionStrategy =
  | "fully_parallel"
  | "fully_sequential"
  | "hybrid";

export type ScopeRiskLevel = "low" | "medium" | "high";

export type ScopeSection = {
  section_id: string;
  title: string;
  description: string;
  assigned_agents: string[];
  checklist: string[];
  dependencies: string[];
  priority: "critical" | "high" | "medium" | "low";
  data_requirements: string[];
  success_criteria: string[];
};

export type ScopeRiskAssessment = {
  data_availability_risk: ScopeRiskLevel;
  complexity_risk: ScopeRiskLevel;
  timeline_risk: ScopeRiskLevel;
  mitigation_strategy: string;
};

export type ScopePlan = {
  project_title: string;
  total_sections: number;
  execution_strategy: ExecutionStrategy;
  sections: ScopeSection[];
  risk_assessment: ScopeRiskAssessment;
};

export type TrustLevel = "verified" | "trusted";
export type AccessLevel = "free" | "paid";

export type RankedSource = {
  id: string;
  name: string;
  url: string;
  description: string;
  trustLevel: TrustLevel;
  access: AccessLevel;
  matchScore: number;
  matchedOn: Array<"sector" | "function" | "geography">;
};

export type ExcludedSource = {
  id: string;
  name: string;
  trustLevel: TrustLevel;
  reason: string;
};

export type CompanyMatch = {
  name: string;
  officialUrl: string | null;
  confidence: number;
};

export type DataSourceManagerState = {
  sector: string;
  function: string;
  geography: string;
  trusted_sources_only: boolean;
  recommended_sources: RankedSource[];
  supplementary_sources: RankedSource[];
  excluded_sources: ExcludedSource[];
  detected_companies: CompanyMatch[];
  notes: string[];
};

export type DataSourcesState = {
  data_source_manager: DataSourceManagerState;
};

export type RetrievalMethod = "api" | "download" | "report" | "data_share";
export type ConnectionStatus =
  | "ready"
  | "requires_credentials"
  | "not_applicable";

export type DatasetDescriptor = {
  title: string;
  description: string;
  retrievalMethod: RetrievalMethod;
  url: string | null;
};

export type DataConnection = {
  sourceId: string;
  name: string;
  access: AccessLevel;
  trustLevel: TrustLevel;
  status: ConnectionStatus;
  notes: string;
  datasets: DatasetDescriptor[];
};

export type DataConnectionContext = {
  sector: string;
  function: string;
  geography: string;
  timeframe?: string;
  keywords: string[];
};

export type DataConnectionSummary = {
  context: DataConnectionContext;
  connections: DataConnection[];
};

export type SearchChannel = "web" | "proprietary" | "user_files";

export type SearchTask = {
  id: string;
  channel: SearchChannel;
  target: string;
  query: string;
  rationale: string;
  expectedOutput: string;
};

export type SectionCoverage = {
  sectionId: string;
  sectionTitle: string;
  plannedTasks: string[];
  unmetRequirements: string[];
};

export type SnowflakeSearchResult = {
  sectionId: string;
  sectionTitle: string;
  requirement: string;
  sql: string;
  rows: Array<Record<string, unknown>>;
  error?: string;
};

export type SnowflakeSearchStatus = "disabled" | "connected" | "error";

export type SnowflakeSearchSummary = {
  status: SnowflakeSearchStatus;
  message?: string;
  results: SnowflakeSearchResult[];
};

export type WebSearchResult = {
  sectionId: string;
  query: string;
  summary: string;
  snippets: string[];
  sources: string[];
  confidence: "high" | "medium" | "low";
};

export type ProprietarySearchResult = {
  sectionId: string;
  sourceId: string;
  dataset: string;
  summary: string;
  availability: "available" | "requires_access";
  nextSteps: string;
};

export type UserFileInsight = {
  sectionId: string;
  filename: string;
  summary: string;
  keyMetrics: string[];
};

export type SearchPlanSummary = {
  tasks: SearchTask[];
  coverage: SectionCoverage[];
  snowflake?: SnowflakeSearchSummary;
  web: WebSearchResult[];
  proprietary: ProprietarySearchResult[];
  userFiles: UserFileInsight[];
};

export type DataGap = {
  id: string;
  description: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
};

export type DataGapSummary = {
  gaps: DataGap[];
  notes: string[];
};

export type AnalysisComponent = {
  sectionId: string;
  title: string;
  approach: string;
  inputs: string[];
  preliminaryFindings: string;
  visualization: string;
  analysisSummary: string;
  description: string;
};

export type AnalysisSummary = {
  components: AnalysisComponent[];
  notes: string[];
};

export type PresentationSection = {
  title: string;
  keyFindings: string[];
  supportingData: string[];
  nextSteps: string;
};

export type PresentationPayload = {
  executiveSummary: string;
  sections: PresentationSection[];
  appendices: string[];
};

export type DeliverableMode = "exec" | "detailed";

export type RenderedVisual = {
  id: string;
  type: "chart" | "table";
  title: string;
  description: string;
  source: string;
  cached: boolean;
};

export type RenderedSection = {
  id: string;
  title: string;
  density: DeliverableMode;
  summary: string[];
  dataHighlights: string[];
  visuals: RenderedVisual[];
  narrative: string;
};

export type DeliverableExport = {
  format: "pdf" | "pptx" | "docx" | "csv";
  filename: string;
  status: "queued" | "ready" | "error";
  includes: string[];
};

export type DeliverableCitationAnchor = {
  id: string;
  sectionId: string;
  label: string;
  target: string;
};

export type DeliverableCitationEntry = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  access: string;
  trustLevel: string;
  retrievedAt: string;
};

export type RenderedDeliverable = {
  template: string;
  version: {
    current: number;
    history: Array<{
      version: number;
      summary: string;
      timestamp: string;
    }>;
  };
  pagination: {
    totalPages: number;
    strategy: string;
  };
  mode: DeliverableMode;
  controls: {
    availableModes: DeliverableMode[];
    defaultMode: DeliverableMode;
  };
  locale: string;
  numberFormat: string;
  dateFormat: string;
  executiveSummary: {
    headline: string;
    body: string[];
    highlights: string[];
  };
  sections: RenderedSection[];
  appendices: string[];
  exports: DeliverableExport[];
  citations: {
    anchors: DeliverableCitationAnchor[];
    bibliography: DeliverableCitationEntry[];
  };
  accessibility: {
    status: "pending" | "ready";
    checklist: string[];
  };
  assets: {
    visualCache: RenderedVisual[];
  };
  internationalization: {
    timezone: string;
  };
};

export type ReviewerSection = {
  title: string;
  summary: string[];
  supportingData: string[];
  nextSteps: string;
};

export type ReviewerReport = {
  executiveSummary: string;
  sections: ReviewerSection[];
  dataGaps: DataGap[];
  sources: RankedSource[];
  appendices: string[];
};

export type ReviewerState = {
  checklist_completion: number;
  data_gaps_identified: boolean;
  trusted_sources_used: boolean;
  format_correct: boolean;
  quality_score: number;
  revisions_needed: string[];
  report: ReviewerReport;
};

export type AgentDataByIdentifier = {
  prompt_enhancer: EnhancedPrompt;
  lead_manager: ScopePlan;
  data_source_manager: DataSourcesState;
  data_connector: DataConnectionSummary;
  data_searcher: SearchPlanSummary;
  expert_input: DataGapSummary;
  data_analyzer: AnalysisSummary;
  data_presenter: PresentationPayload;
  render_packager: RenderedDeliverable;
  reviewer: ReviewerState;
};

export type AgentThought<TAgent extends AgentIdentifier = AgentIdentifier> = {
  summary?: string;
  reasoning?: string;
  data?: AgentDataByIdentifier[TAgent] | string | string[] | null;
};

export type AgentExecutionRecord<TAgent extends AgentIdentifier = AgentIdentifier> = {
  agent: TAgent;
  timestamp: Date;
  status: AgentTimelineStatus;
  output?: AgentThought<TAgent>;
};

export type AgentStateSnapshot = {
  userInput: ChatMessage;
  userProfile?: User;
  enhancedPrompt?: EnhancedPrompt;
  scope?: ScopePlan;
  dataSources?: DataSourcesState;
  dataConnections?: DataConnectionSummary;
  searchResults?: SearchPlanSummary;
  dataGaps?: DataGapSummary;
  analysisResults?: AnalysisSummary;
  presentation?: PresentationPayload;
  renderedDeliverable?: RenderedDeliverable;
  review?: ReviewerState;
  currentAgent?: AgentIdentifier;
  executionHistory: AgentExecutionRecord[];
};
