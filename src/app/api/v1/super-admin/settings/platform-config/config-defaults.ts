export const CONFIG_DEFAULTS: Record<string, { value: string; type: string; label: string }> = {
  trial_duration_days: { value: "30", type: "number", label: "Trial Duration (days)" },
  trial_unit_limit: { value: "50", type: "number", label: "Trial Unit Limit" },
  session_timeout_hours: { value: "8", type: "number", label: "Session Timeout (hours)" },
  default_fee_grace_days: { value: "15", type: "number", label: "Fee Grace Period (days)" },
  support_email: { value: "", type: "string", label: "Support Email" },
  support_phone: { value: "", type: "string", label: "Support Phone" },
  counsellor_role_enabled: {
    value: "false",
    type: "boolean",
    label: "Counsellor Role Enabled",
  },
};
