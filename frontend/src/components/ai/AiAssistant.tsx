import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Box, Fab, IconButton, Paper, TextField, Typography, Button, CircularProgress, Chip, Tooltip } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import AiChart, { AiChartSpec } from "./AiChart";

const API_URL = process.env.REACT_APP_API_URL || "/api";

// Must match AI_ALLOWED_ROLES on the backend (routes/ai.js default).
export const AI_ROLES = ["Admin", "HR", "Management"];

// Fired after a chart is pinned so the dashboard's AI Insights section reloads.
export const AI_INSIGHTS_EVENT = "ai-insights-changed";

interface Message {
  role: "user" | "model";
  text: string;
  charts?: AiChartSpec[];
  question?: string;
  error?: boolean;
}

const SUGGESTIONS = [
  "How many active employees are in each department?",
  "Show monthly joinings for the last 12 months",
  "Which departments had the most exits this year?",
  "How many confirmations are pending with managers?",
];

// Minimal formatting for model replies: **bold** and "- " / "* " bullets.
function renderText(text: string) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part
    );
  return text.split("\n").map((line, i) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    if (bullet) return <Box key={i} component="li" sx={{ ml: 2 }}>{inline(bullet[1])}</Box>;
    return line.trim() ? <Box key={i} sx={{ mb: 0.5 }}>{inline(line)}</Box> : <Box key={i} sx={{ height: 6 }} />;
  });
}

const AiAssistant: React.FC = () => {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, open]);

  if (!user || !AI_ROLES.includes(user.role)) return null;

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/ai/chat`, { message, history });
      setMessages((prev) => [...prev, { role: "model", text: res.data.answer, charts: res.data.charts, question: message }]);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Something went wrong";
      setMessages((prev) => [...prev, { role: "model", text: msg, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const pin = async (chart: AiChartSpec, question: string | undefined, key: string) => {
    try {
      const { data, ...spec } = chart;
      await axios.post(`${API_URL}/ai/insights`, { ...spec, question });
      setPinned((prev) => new Set(prev).add(key));
      window.dispatchEvent(new Event(AI_INSIGHTS_EVENT));
    } catch (err: any) {
      const msg = err.response?.data?.error || "Could not pin chart";
      setMessages((prev) => [...prev, { role: "model", text: `Could not pin chart: ${msg}`, error: true }]);
    }
  };

  const bg = darkMode ? "#1e1e1e" : "#ffffff";
  const soft = darkMode ? "#2a2a2a" : "#f1f5f9";
  const border = darkMode ? "#333" : "#e2e8f0";

  return (
    <>
      {!open && (
        <Tooltip title="Ask AI about your HR data" placement="left">
          <Fab
            onClick={() => setOpen(true)}
            sx={{ position: "fixed", bottom: 24, right: 24, zIndex: 1300, color: "#fff", background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
          >
            <AutoAwesomeIcon />
          </Fab>
        </Tooltip>
      )}

      {open && (
        <Paper
          elevation={12}
          sx={{
            position: "fixed", bottom: { xs: 0, sm: 24 }, right: { xs: 0, sm: 24 }, zIndex: 1300,
            width: { xs: "100vw", sm: 440 }, height: { xs: "100vh", sm: "min(680px, calc(100vh - 48px))" },
            display: "flex", flexDirection: "column", borderRadius: { xs: 0, sm: "16px" }, overflow: "hidden", bgcolor: bg,
          }}
        >
          {/* Header */}
          <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1, color: "#fff", background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
            <AutoAwesomeIcon fontSize="small" />
            <Typography fontWeight={700} sx={{ flex: 1 }}>HR AI Assistant</Typography>
            {messages.length > 0 && (
              <Tooltip title="Clear chat">
                <IconButton size="small" sx={{ color: "#fff" }} onClick={() => setMessages([])}><DeleteSweepOutlinedIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            <IconButton size="small" sx={{ color: "#fff" }} onClick={() => setOpen(false)}><CloseIcon fontSize="small" /></IconButton>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {messages.length === 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" mb={1.5}>
                  Ask anything about employees, hiring, exits, confirmations, salary revisions, trainings and more.
                  Ask for a chart and pin it to your dashboard if it isn't there already.
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {SUGGESTIONS.map((s) => (
                    <Chip key={s} label={s} onClick={() => send(s)} variant="outlined"
                      sx={{ justifyContent: "flex-start", height: "auto", py: 0.75, "& .MuiChip-label": { whiteSpace: "normal" } }} />
                  ))}
                </Box>
              </Box>
            )}

            {messages.map((m, i) => (
              <Box key={i} sx={{ alignSelf: m.role === "user" ? "flex-end" : "stretch", maxWidth: m.role === "user" ? "85%" : "100%" }}>
                <Box sx={{
                  px: 1.5, py: 1, borderRadius: "12px", fontSize: "0.875rem", lineHeight: 1.5,
                  bgcolor: m.role === "user" ? "#4f46e5" : m.error ? (darkMode ? "#3b1d1d" : "#fef2f2") : soft,
                  color: m.role === "user" ? "#fff" : m.error ? "#dc2626" : "text.primary",
                }}>
                  {m.role === "user" ? m.text : renderText(m.text)}
                </Box>
                {m.charts?.map((c, j) => {
                  const key = `${i}-${j}`;
                  return (
                    <Box key={key} sx={{ mt: 1, p: 1.5, border: `1px solid ${border}`, borderRadius: "12px" }}>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography fontWeight={700} fontSize="0.875rem">{c.title}</Typography>
                          {c.description && <Typography variant="caption" color="text.secondary">{c.description}</Typography>}
                        </Box>
                        <Button size="small" startIcon={<PushPinOutlinedIcon fontSize="small" />} disabled={pinned.has(key)}
                          onClick={() => pin(c, m.question, key)} sx={{ textTransform: "none", flexShrink: 0 }}>
                          {pinned.has(key) ? "Pinned to dashboard" : "Pin"}
                        </Button>
                      </Box>
                      <AiChart spec={c} dark={darkMode} />
                    </Box>
                  );
                })}
              </Box>
            ))}

            {loading && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", fontSize: "0.85rem" }}>
                <CircularProgress size={16} /> Analysing your data…
              </Box>
            )}
            <div ref={endRef} />
          </Box>

          {/* Input */}
          <Box sx={{ p: 1.5, borderTop: `1px solid ${border}`, display: "flex", gap: 1, alignItems: "flex-end" }}>
            <TextField
              fullWidth size="small" multiline maxRows={4} placeholder="Ask about your HR data…"
              value={input} onChange={(e) => setInput(e.target.value)} disabled={loading} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <IconButton color="primary" onClick={() => send()} disabled={loading || !input.trim()}><SendIcon /></IconButton>
          </Box>
        </Paper>
      )}
    </>
  );
};

export default AiAssistant;
