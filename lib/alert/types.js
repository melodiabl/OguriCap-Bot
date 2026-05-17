// Tipos de alertas
export const ALERT_TYPES = {
  THRESHOLD: 'threshold',
  ANOMALY: 'anomaly',
  PATTERN: 'pattern',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  AVAILABILITY: 'availability',
  CUSTOM: 'custom'
};

// Severidades de alertas
export const ALERT_SEVERITIES = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
  EMERGENCY: 5
};

// Estados de alertas
export const ALERT_STATES = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  SUPPRESSED: 'suppressed',
  EXPIRED: 'expired'
};

// Condiciones de alertas
export const ALERT_CONDITIONS = {
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
  EQUALS: 'eq',
  NOT_EQUALS: 'ne',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  REGEX: 'regex',
  CHANGE_RATE: 'change_rate',
  DEVIATION: 'deviation'
};
