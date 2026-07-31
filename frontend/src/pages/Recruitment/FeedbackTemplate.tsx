import React, { ChangeEvent, useEffect, useState } from "react";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, TextField, Typography,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

export const TEMPLATE_FIELDS = [
  { id: "resume",      label: "View Resume",          section: "Candidate" },
  { id: "linkedin",    label: "LinkedIn profile",     section: "Candidate" },
  { id: "native",      label: "Native",               section: "Candidate" },
  { id: "residing",    label: "Residing",             section: "Candidate" },
  { id: "commute",     label: "Commute",              section: "Candidate" },
  { id: "age",         label: "Age",                  section: "Candidate" },
  { id: "family",      label: "Family",               section: "Candidate" },
  { id: "maritalStatus", label: "Marital Status", section: "Candidate" },
  { id: "experience",  label: "Experience",           section: "Professional" },
  { id: "ctc",         label: "CTC",                  section: "Professional" },
  { id: "ectc",        label: "ECTC",                 section: "Professional" },
  { id: "recomctc",    label: "Recommended CTC",      section: "Professional" },
  { id: "reason",      label: "Reason",               section: "Professional" },
  { id: "noticep",     label: "Notice Period",        section: "Professional" },
  { id: "whenjoin",    label: "When can join",        section: "Professional" },
  { id: "coreskills",  label: "Core Skills",          section: "Professional", full: true },
  { id: "projects",    label: "Projects",             section: "Professional" },
  { id: "certifications", label: "Certifications",   section: "Professional" },
  { id: "commskills",  label: "Communication Skills", section: "Assessment" },
  { id: "stability",   label: "Stability",            section: "Assessment" },
  { id: "attitude",    label: "Attitude / DISC Summary", section: "Assessment" },
  { id: "education",   label: "Education",            section: "Assessment" },
  { id: "hobbies",     label: "Hobbies",              section: "Assessment" },
  { id: "bond",        label: "Bond",                 section: "Assessment" },
  { id: "remarks",     label: "Remarks",              section: "Assessment", multiline: true, full: true },
] as const;

export const SECTIONS = ["Candidate", "Professional", "Assessment"] as const;

type TemplateField = (typeof TEMPLATE_FIELDS)[number];
type TemplateFieldId = TemplateField["id"];
type TemplateVals = Record<TemplateFieldId, string> & { __round?: string; __screener?: string };

export const EMPTY_TEMPLATE = Object.fromEntries(
  TEMPLATE_FIELDS.map(f => [f.id, ""])
) as Record<TemplateFieldId, string>;

const LABEL_MAP: Record<TemplateFieldId, string> = {
  resume:      "View Resume",
  linkedin:    "LinkedIn profile",
  native:      "Native",
  residing:    "Residing",
  commute:     "Commute",
  age:         "Age",
  family:      "Family",
  maritalStatus: "Marital Status",
  experience:  "Experience",
  ctc:         "CTC",
  ectc:        "ECTC",
  recomctc:    "Recommended CTC",
  reason:      "Reason",
  noticep:     "Notice Period",
  whenjoin:    "When can join",
  coreskills:  "Core Skills",
  projects:    "Projects",
  certifications: "Certifications",
  commskills:  "Communication Skills",
  stability:   "Stability",
  attitude:    "Attitude / DISC Summary",
  education:   "Education",
  hobbies:     "Hobbies",
  bond:        "Bond",
  remarks:     "Remarks",
};


const KNOWN_LABELS = Object.values(LABEL_MAP).map(l => l.replace(/\./g, "\\."));
const BLEED_PATTERN = new RegExp(`^(${KNOWN_LABELS.join("|")}):\\s*`, "i");

function stripBleed(value: string): string {
  const match = value.match(BLEED_PATTERN);
  return match ? "" : value; // if the whole value IS another field's line, treat this field as empty
}
// Unique per-field autocomplete token so the browser can't group/sync fields
// (autoComplete="new-password" on every field was causing Chrome to treat
// them as a password-confirmation group and mirror values across fields)
const noAutofill = (id: string) => `off-${id}-no-fill`;

type TemplateModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
  screenerName?: string;
  existingText?: string;
  defaultRound?: string;
  title?: string;
};

export function buildFormattedText(vals: TemplateVals) {
  const round    = vals.__round || "";
  const screener = vals.__screener || "";
  const sep      = "-".repeat(77);
  let lines = `*\n${round} "${screener}"\n${sep}\n`;
  TEMPLATE_FIELDS.forEach(({ id }) => {
    lines += `${LABEL_MAP[id]}: ${vals[id] || ""}\n`;
  });
  return lines.trim();
}

export function parseFormattedText(text?: string): TemplateVals | null {
  if (!text) return null;
  const result: TemplateVals = { ...EMPTY_TEMPLATE };

  const headerMatch = text.match(/^(.+?)\s+"(.+?)"/m);
  if (headerMatch) {
    result.__round    = headerMatch[1].trim();
    result.__screener = headerMatch[2].trim();
  }

  const aliasMap: Array<[TemplateFieldId, string[]]> = [
    ['resume', ['View Resume']],
    ['linkedin', ['LinkedIn profile', 'LinkedIn']],
    ['native', ['Native']],
    ['residing', ['Residing']],
    ['commute', ['Commute']],
    ['age', ['Age']],
    ['family', ['Family']],
    ['maritalStatus', ['Marital Status']],
    ['experience', ['Experience']],
    ['ctc', ['CTC']],
    ['ectc', ['ECTC']],
    ['recomctc', ['Recommended CTC', 'Recom. CTC']],
    ['reason', ['Reason', 'Reason for leaving']],
    ['noticep', ['Notice Period']],
    ['whenjoin', ['When can join']],
    ['coreskills', ['Core Skills']],
    ['projects', ['Projects']],
    ['certifications', ['Certifications']],
    ['commskills', ['Communication Skills']],
    ['stability', ['Stability']],
    ['attitude', ['Attitude / DISC Summary', 'Attitude']],
    ['education', ['Education']],
    ['hobbies', ['Hobbies']],
    ['bond', ['Bond']],
    ['remarks', ['Remarks', 'Remarks']],
  ];

  for (const [id, labels] of aliasMap) {
  for (const label of labels) {
    const escaped = label.replace(/\./g, "\\.");
    const match = text.match(new RegExp(`^${escaped}:\\s*(.*)$`, "m"));
    if (match) {
      result[id] = stripBleed(match[1].trim());
      break;
    }
  }
}

  return result;
}

export const TemplateModal = ({ open, onClose, onInsert, screenerName, existingText, defaultRound, title }: TemplateModalProps) => {
  const [vals, setVals] = useState(() => {
    const parsed = parseFormattedText(existingText);
    return parsed
      ? { ...parsed }
      : { ...EMPTY_TEMPLATE, __round: defaultRound || "HR Round", __screener: screenerName || "" };
  });
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!open) return;

    const parsed = parseFormattedText(existingText);
    if (parsed) {
      setVals({
        ...parsed,
        // Always prefer the passed props over whatever was parsed from text
        __round:    defaultRound  || parsed.__round    || "HR Round",
        __screener: screenerName  || parsed.__screener || "",
      });
    } else {
      setVals({ ...EMPTY_TEMPLATE, __round: defaultRound || "HR Round", __screener: screenerName || "" });
    }
  }, [open, existingText, screenerName, defaultRound]);

  const set = (id: keyof TemplateVals) => (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setVals(prev => ({ ...prev, [id]: e.target.value }));

  const fieldSx = {
    "& .MuiInputBase-input, & .MuiInputBase-inputMultiline": {
      fontSize: "0.85rem", py: "8px", px: "10px", lineHeight: 1.5,
    },
    "& fieldset": { borderColor: "#d0daea" },
    bgcolor: "#fff",
  };

  const labelSx = {
    fontSize: "0.72rem", fontWeight: 700, color: "#5a6a85",
    textTransform: "uppercase", letterSpacing: 0.5, mb: 0.5,
  };

  const handleInsert = () => {
    onInsert(buildFormattedText(vals));
    onClose();
  };

  const handleClear = () =>
    setVals({ ...EMPTY_TEMPLATE, __round: defaultRound || "HR Round", __screener: screenerName || "" });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: "90vh" } }}>
      <DialogTitle sx={{
        background: "linear-gradient(135deg, #1976d2 0%, #0d4d99 100%)",
        color: "#fff", py: 1.5, fontSize: "0.9rem", fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {title || 'HR Feedback Template'}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Box sx={{ display: "flex", bgcolor: "rgba(255,255,255,0.15)", borderRadius: 1, p: "2px", gap: "2px" }}>
            {["Edit", "Preview"].map((tab, i) => (
              <Box key={tab} onClick={() => setPreview(i === 1)}
                sx={{
                  px: 1.5, py: 0.4, borderRadius: 0.8, cursor: "pointer",
                  fontSize: "0.72rem", fontWeight: 600,
                  bgcolor: preview === (i === 1) ? "rgba(255,255,255,0.25)" : "transparent",
                  color: "#fff", transition: "background 0.15s",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                }}>
                {tab}
              </Box>
            ))}
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "#fff" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, overflowY: "auto" }}>
        {preview ? (
          <Box sx={{ p: 2.5 }}>
            <Box sx={{
              bgcolor: "#f8fafd", border: "1px solid #e4eaf4", borderRadius: 1.5,
              p: 2, fontFamily: "monospace", fontSize: "0.78rem",
              color: "#1a1a2e", whiteSpace: "pre-wrap", lineHeight: 1.8,
            }}>
              {buildFormattedText(vals)}
            </Box>
          </Box>
        ) : (
          <Box component="form" autoComplete="off" noValidate sx={{ p: 2.5 }}>
            {/* View Resume + LinkedIn — pinned to the very top, always visible */}
            <Box sx={{
              display: "flex", flexWrap: "wrap", gap: 1.5, mb: 2,
              bgcolor: "#eef8f1", border: "1px solid #cdeadb", borderRadius: 1.5, p: 1.5,
            }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={labelSx}>View Resume</Typography>
                <TextField
                  name="resume" id="resume"
                  autoComplete={noAutofill("resume")}
                  fullWidth size="small"
                  value={vals.resume || ""}
                  onChange={set("resume")}
                  placeholder="Paste resume link or note"
                  sx={fieldSx}
                  inputProps={{ autoComplete: noAutofill("resume") }}
                  InputProps={vals.resume && /^https?:\/\//i.test(vals.resume) ? {
                    endAdornment: (
                      <Button
                        size="small"
                        href={vals.resume}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ fontSize: "0.68rem", textTransform: "none", whiteSpace: "nowrap" }}
                      >
                        Open
                      </Button>
                    ),
                  } : undefined}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={labelSx}>LinkedIn Profile</Typography>
                <TextField
                  name="linkedin" id="linkedin"
                  autoComplete={noAutofill("linkedin")}
                  fullWidth size="small"
                  value={vals.linkedin || ""}
                  onChange={set("linkedin")}
                  placeholder="Paste LinkedIn profile link"
                  sx={fieldSx}
                  inputProps={{ autoComplete: noAutofill("linkedin") }}
                  InputProps={vals.linkedin && /^https?:\/\//i.test(vals.linkedin) ? {
                    endAdornment: (
                      <Button
                        size="small"
                        href={vals.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ fontSize: "0.68rem", textTransform: "none", whiteSpace: "nowrap" }}
                      >
                        Open
                      </Button>
                    ),
                  } : undefined}
                />
              </Box>
            </Box>

            {/* Round + Screener */}
            <Box sx={{ bgcolor: "#f0f6ff", border: "1px solid #d0dff5", borderRadius: 1.5, p: 1.5, mb: 2 }}>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#1976d2", textTransform: "uppercase", letterSpacing: 0.6, mb: 1 }}>
                Header
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 1.5 }}>
                <Box>
                  <Typography sx={labelSx}>Round</Typography>
                  <TextField
                    autoComplete={noAutofill("round")}
                    name="__round"
                    fullWidth size="small"
                    value={vals.__round || ""}
                    onChange={set("__round")}
                    placeholder="e.g. HR Round"
                    sx={fieldSx}
                    inputProps={{ autoComplete: noAutofill("round") }}
                  />
                </Box>
                <Box>
                  <Typography sx={labelSx}>Screener</Typography>
                  <TextField
                    autoComplete={noAutofill("screener")}
                    name="__screener"
                    fullWidth size="small"
                    value={vals.__screener || ""}
                    onChange={set("__screener")}
                    placeholder=""
                    sx={fieldSx}
                    inputProps={{ autoComplete: noAutofill("screener") }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Sections */}
            {SECTIONS.map(section => {
              const fields = TEMPLATE_FIELDS.filter(f => f.section === section && f.id !== "resume" && f.id !== "linkedin");
              return (
                <Box key={section} sx={{ mb: 2.5 }}>
                  <Typography sx={{
                    fontSize: "0.7rem", fontWeight: 700, color: "#5a6a85",
                    textTransform: "uppercase", letterSpacing: 0.8,
                    mb: 1.2, pb: 0.6, borderBottom: "1.5px solid #e4eaf4",
                    display: "flex", alignItems: "center", gap: 1,
                    "&::before": {
                      content: '""', display: "inline-block",
                      width: "3px", height: "10px", borderRadius: "2px",
                      backgroundColor: "#1976d2",
                    },
                  }}>
                    {section}
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 1.75 }}>
                    {fields.map((field) => {
                      const { id, label } = field;
                      const full = "full" in field && field.full;
                      const multiline = "multiline" in field && field.multiline;

                      return (
                        <Box key={id} sx={{ gridColumn: full ? "1 / -1" : undefined }}>
                          <Typography sx={labelSx}>{label}</Typography>
                          {id === "maritalStatus" ? (
                            <select
                              name={id}
                              id={id}
                              autoComplete="off"
                              value={vals[id] || ""}
                              onChange={set(id)}
                              style={{
                                fontSize: "0.78rem", padding: "5px 8px",
                                border: "1.5px solid #d0daea", borderRadius: "6px",
                                width: "100%", backgroundColor: "#fff",
                                color: vals[id] ? "#1a1a2e" : "#aaa",
                                outline: "none", fontFamily: "inherit",
                                cursor: "pointer",
                              }}
                            >
                              <option value="">Select</option>
                              <option value="Married">Married</option>
                              <option value="Single">Single</option>
                              <option value="Widowed">Widowed</option>
                              <option value="Divorced">Divorced</option>
                            </select>
                          ) : (
                            <TextField
                              name={id}
                              id={id}
                              autoComplete={noAutofill(id)}
                              fullWidth size="small"
                              value={vals[id] || ""}
                              onChange={set(id)}
                              multiline={!!multiline}
                              rows={multiline ? 3 : undefined}
                              sx={fieldSx}
                              inputProps={{ autoComplete: noAutofill(id) }}
                            />
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1, borderTop: "1px solid #e4eaf4" }}>
        <Button size="small" onClick={handleClear}
          sx={{ fontSize: "0.75rem", textTransform: "none", color: "#6b7a99" }}>
          Clear all
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={onClose}
          sx={{ fontSize: "0.75rem", textTransform: "none" }}>
          Cancel
        </Button>

        <Button size="small" variant="contained"
          onClick={handleInsert}
          sx={{
            fontSize: "0.75rem", textTransform: "none",
            background: "linear-gradient(135deg, #1976d2 0%, #0d4d99 100%)",
          }}>
          Insert into feedback
        </Button>
      </DialogActions>
    </Dialog>
  );
};