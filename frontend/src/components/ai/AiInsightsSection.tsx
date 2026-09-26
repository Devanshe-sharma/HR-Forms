import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Box, Typography, IconButton, Tooltip, CircularProgress } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useAuth } from "../../contexts/AuthContext";
import AiChart, { AiChartSpec } from "./AiChart";
import { AI_ROLES, AI_INSIGHTS_EVENT } from "./AiAssistant";

const API_URL = process.env.REACT_APP_API_URL || "/api";

interface Insight extends Omit<AiChartSpec, "collection"> {
  _id: string;
  collectionName: string;
  question?: string;
  error?: string;
}

// Charts pinned from the AI assistant — re-run against live data on load.
const AiInsightsSection: React.FC = () => {
  const { user } = useAuth();
  const allowed = !!user && AI_ROLES.includes(user.role);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/ai/insights`);
      setInsights(res.data.data || []);
    } catch {
      // leave the section empty rather than break the dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    load();
    window.addEventListener(AI_INSIGHTS_EVENT, load);
    return () => window.removeEventListener(AI_INSIGHTS_EVENT, load);
  }, [allowed, load]);

  const remove = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/ai/insights/${id}`);
      setInsights((prev) => prev.filter((i) => i._id !== id));
    } catch {
      window.alert("Could not remove insight");
    }
  };

  if (!allowed) return null;

  return (
    <Box sx={{ mb: 3, flexShrink: 0 }}>
      <Typography fontSize="0.75rem" fontWeight={800} color="#334155" letterSpacing="0.08em" mb={1.25}>
        MY AI INSIGHTS
      </Typography>
      {loading ? (
        <CircularProgress size={20} />
      ) : insights.length === 0 ? (
        <Box sx={{ p: 2, border: "1px dashed #cbd5e1", borderRadius: "12px", display: "flex", alignItems: "center", gap: 1, color: "#64748b" }}>
          <AutoAwesomeIcon fontSize="small" sx={{ color: "#7c3aed" }} />
          <Typography variant="body2">
            Need a metric that isn't here? Ask the AI assistant (bottom-right) for a chart and pin it — it will show up here with live data.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(auto-fill, minmax(380px, 1fr))" }, gap: 2 }}>
          {insights.map((ins) => (
            <Box key={ins._id} sx={{ p: 2, bgcolor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700} fontSize="0.9rem" color="#0f172a">{ins.title}</Typography>
                  {ins.description && <Typography variant="caption" color="#64748b">{ins.description}</Typography>}
                </Box>
                <Tooltip title="Remove from dashboard">
                  <IconButton size="small" onClick={() => remove(ins._id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
              {ins.error ? (
                <Typography variant="body2" color="error">This insight could not be loaded: {ins.error}</Typography>
              ) : (
                <AiChart spec={{ ...ins, collection: ins.collectionName }} />
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default AiInsightsSection;
