import type {
  DataConnection,
  DatasetDescriptor,
  ScopeSection,
  SectionCoverage,
  SearchTask,
} from "../types";

export function isScopeSection(value: unknown): value is ScopeSection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ScopeSection>;
  return (
    typeof candidate.section_id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.data_requirements)
  );
}

export function isDataConnection(value: unknown): value is DataConnection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DataConnection>;
  return (
    typeof candidate.sourceId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.status === "string" &&
    Array.isArray(candidate.datasets)
  );
}

export function isDatasetDescriptor(value: unknown): value is DatasetDescriptor {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DatasetDescriptor>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.retrievalMethod === "string"
  );
}

export function isSectionCoverage(value: unknown): value is SectionCoverage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SectionCoverage>;
  return (
    typeof candidate.sectionId === "string" &&
    Array.isArray(candidate.plannedTasks) &&
    Array.isArray(candidate.unmetRequirements)
  );
}

export function isSearchTask(value: unknown): value is SearchTask {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SearchTask>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.channel === "string" &&
    typeof candidate.target === "string" &&
    typeof candidate.query === "string"
  );
}
