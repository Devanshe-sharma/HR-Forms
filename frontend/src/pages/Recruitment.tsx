'use client';

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip,
  Alert, // ← Bring back the standard Grid
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

import Grid from "@mui/material/GridLegacy";

import Sidebar from '../components/Sidebar';
import Navbar from "../components/Navbar";

const FMS_API_URL =
  "https://script.google.com/macros/s/AKfycbxDJcRbg1JXQqryWwQkH4N-oUCGed9DQph20Bxg4bwdwCnGes4ei2VVbXzBdE_GHfJ5pg/exec";

interface Requisition {
  [key: string]: string | number | null;
}

interface Candidate {
  Name?: string;
  Email?: string;
  City?: string;
  State?: string;
  Source?: string;
  Timestamp?: string;
  Status?: string;
  Position?: string;
}

export default function Recruitment() {
  const location = useLocation();

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [filteredReqs, setFilteredReqs] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);
  const [formData, setFormData] = useState({
    joiningDays: 0,
    budget: "",
    assignedTo: "",
  });
  const [saving, setSaving] = useState(false);

  // CANDIDATE MODAL
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [selectedDesignation, setSelectedDesignation] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // FILTER STATES
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFMS, setFilterFMS] = useState("Open");
  const [dateRange, setDateRange] = useState("all");
  const [customStart, setCustomStart] = useState<dayjs.Dayjs | null>(null);
  const [customEnd, setCustomEnd] = useState<dayjs.Dayjs | null>(null);

  // MODAL FILTER STATES
  const [modalSearch, setModalSearch] = useState("");
  const [modalStatus, setModalStatus] = useState("");
  const [modalDate, setModalDate] = useState<dayjs.Dayjs | null>(null);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);

  // Sidebar open state (for mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchRequisitions();
  }, []);

  useEffect(() => {
    let list = [...candidates];
    if (modalSearch) {
      const q = modalSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.Name?.toLowerCase().includes(q) || c.Email?.toLowerCase().includes(q)
      );
    }
    if (modalStatus) list = list.filter((c) => c.Status === modalStatus);
    if (modalDate)
      list = list.filter((c) =>
        dayjs(c.Timestamp).isAfter(modalDate.startOf("day"))
      );
    setFilteredCandidates(list);
  }, [candidates, modalSearch, modalStatus, modalDate]);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${FMS_API_URL}?action=getFMS`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "API error");
      setRequisitions(data.data);
      setFilteredReqs(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const extractJoiningDays = (text: string | null | undefined): number => {
    if (!text) return 0;
    const match = text.match(/(\d+)\s*days/);
    return match ? Number(match[1]) : 0;
  };

  const uniqueValues = useMemo(() => {
    return {
      dept: [...new Set(requisitions.map((r) => r["Hiring Dept"]).filter(Boolean))].sort() as string[],
      role: [...new Set(requisitions.map((r) => r["Designation"]).filter(Boolean))].sort() as string[],
      status: [...new Set(requisitions.map((r) => r["Hiring Status"]).filter(Boolean))].sort() as string[],
      fms: ["Open", "Closed"],
    };
  }, [requisitions]);

  const applyFilters = useCallback(() => {
    let filtered = [...requisitions];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) =>
        String(r["Requisitioner"] || "").toLowerCase().includes(q)
      );
    }

    if (filterDept) filtered = filtered.filter((r) => r["Hiring Dept"] === filterDept);
    if (filterRole) filtered = filtered.filter((r) => r["Designation"] === filterRole);
    if (filterStatus) filtered = filtered.filter((r) => r["Hiring Status"] === filterStatus);
    if (filterFMS) filtered = filtered.filter((r) => r["FMS Status"] === filterFMS);

    if (dateRange !== "all" && dateRange !== "custom") {
      const today = dayjs();
      let start = null;
      switch (dateRange) {
        case "7d":
          start = today.subtract(7, "day");
          break;
        case "15d":
          start = today.subtract(15, "day");
          break;
        case "1m":
          start = today.subtract(1, "month");
          break;
        case "3m":
          start = today.subtract(3, "month");
          break;
      }
      if (start) {
        filtered = filtered.filter((r) =>
          dayjs(r["Request Date"]).isAfter(start.startOf("day"))
        );
      }
    } else if (dateRange === "custom" && customStart && customEnd) {
      filtered = filtered.filter((r) => {
        const d = dayjs(r["Request Date"]);
        return d.isAfter(customStart.startOf("day")) && d.isBefore(customEnd.endOf("day"));
      });
    }

    setFilteredReqs(filtered);
  }, [
    searchQuery,
    filterDept,
    filterRole,
    filterStatus,
    filterFMS,
    dateRange,
    customStart,
    customEnd,
    requisitions,
  ]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleReset = () => {
    setSearchQuery("");
    setFilterDept("");
    setFilterRole("");
    setFilterStatus("");
    setFilterFMS("");
    setDateRange("all");
    setCustomStart(null);
    setCustomEnd(null);
  };

  const handleEdit = (row: Requisition) => {
    setSelectedReq(row);
    setFormData({
      joiningDays: extractJoiningDays(row["Joining Days"] as string),
      budget: String(row["Budget"] || ""),
      assignedTo: String(row["Assigned To"] || ""),
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!selectedReq || saving) return;
    setSaving(true);

    const payload = {
      action: "updateRequisition",
      id: selectedReq["Ser"],
      joiningDays: `${formData.joiningDays} days`,
      budget: formData.budget,
      assignedTo: formData.assignedTo,
    };

    try {
      const res = await fetch(FMS_API_URL, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      const result = await res.json();
      if (result.status !== "success") throw new Error(result.message);

      setRequisitions((prev) =>
        prev.map((r) =>
          r["Ser"] === selectedReq["Ser"]
            ? {
                ...r,
                "Joining Days": payload.joiningDays,
                Budget: payload.budget,
                "Assigned To": payload.assignedTo,
              }
            : r
        )
      );

      setEditOpen(false);
      alert("Requisition updated successfully!");
    } catch (err: any) {
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getFMSColor = (status: string | undefined): string =>
    status === "Open" ? "#4CAF50" : "#9E9E9E";

  // === CANDIDATE MODAL LOGIC ===
  const handleViewCandidates = async (designation: string) => {
    setSelectedDesignation(designation);
    setCandidateModalOpen(true);
    setLoadingCandidates(true);
    setCandidates([]);
    setModalSearch("");
    setModalStatus("");
    setModalDate(null);

    try {
      const res = await fetch(
        `${FMS_API_URL}?action=getCandidatesForDesignation&designation=${encodeURIComponent(
          designation
        )}`
      );
      const data = await res.json();
      if (data.status === "success") {
        setCandidates(data.data);
        setFilteredCandidates(data.data);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoadingCandidates(false);
    }
  };

  if (loading)
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  if (error)
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={fetchRequisitions} startIcon={<RefreshIcon />}>
          Retry
        </Button>
      </Box>
    );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box
        sx={{
          p: { xs: 1, md: 2 },
          fontFamily: "Inter, sans-serif",
          bgcolor: "#f9f9fb",
          minHeight: "100vh",
        }}
      >
        {/* HEADER + REFRESH */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            Requisitions Raised
          </Typography>
          <Tooltip title="Refresh">
            <IconButton
              onClick={fetchRequisitions}
              sx={{ bgcolor: "#6C63FF", color: "#fff" }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* MENU */}
        <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
              <Button component={Link} to="/recruitment" size="small"
                variant={location.pathname === "/recruitment" ? "contained" : "text"} color="primary">
                Requisitions
              </Button>
              <Button component={Link} to="/applicants" size="small"
                variant={location.pathname === "/applicants" ? "contained" : "text"} color="primary">
                Candidates
              </Button>
              <Button component={Link} to="/scoring" size="small"
                variant={location.pathname === "/scoring" ? "contained" : "text"} color="primary">
                Scoring
              </Button>
            </Box>

        {/* FILTERS */}
        <Paper elevation={2} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid xs={12} sm={6} md={2}>
              <TextField
                label="Search Requester"
                size="small"
                fullWidth
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Grid>
            <Grid xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {uniqueValues.dept.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Role</InputLabel>
                <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {uniqueValues.role.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>FMS</InputLabel>
                <Select value={filterFMS} onChange={(e) => setFilterFMS(e.target.value)}>
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {uniqueValues.fms.map((f) => (
                    <MenuItem key={f} value={f}>
                      {f}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {uniqueValues.status.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Select
                size="small"
                fullWidth
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value as string);
                  if (e.target.value !== "custom") {
                    setCustomStart(null);
                    setCustomEnd(null);
                  }
                }}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="7d">Last 7d</MenuItem>
                <MenuItem value="15d">15 Days</MenuItem>
                <MenuItem value="1m">1 Month</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </Grid>
            {dateRange === "custom" && (
              <>
                <Grid item xs={12} sm={6} md={1}>
                  <DatePicker
                    label="From"
                    value={customStart}
                    onChange={setCustomStart}
                    slotProps={{ textField: { size: "small", fullWidth: true } }}
                    format="DD/MMM"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={1}>
                  <DatePicker
                    label="To"
                    value={customEnd}
                    onChange={setCustomEnd}
                    slotProps={{ textField: { size: "small", fullWidth: true } }}
                    minDate={customStart || undefined}
                    format="DD/MMM"
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={6} md={1}>
              <Button variant="outlined" size="small" fullWidth onClick={handleReset}>
                Reset
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* TABLE */}
        <Paper elevation={3} sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ p: 1.5, bgcolor: "#f8f9fa", borderBottom: "1px solid #eee" }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {filteredReqs.length} Requisition(s)
            </Typography>
          </Box>
          <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {[
                    "Date",
                    "Dept",
                    "Role",
                    "Requisitioner",
                    "Max Days",
                    "Hiring Status",
                    "FMS Status",
                    "FMS Score",
                    "Candidates",
                    "Action",
                  ].map((h) => (
                    <TableCell
                      key={h}
                      sx={{
                        fontWeight: 700,
                        bgcolor: "#f1f3f5",
                        fontSize: "0.75rem",
                        py: 1,
                        px: 1,
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReqs.map((row, i) => (
                  <TableRow key={i} hover sx={{ height: 50 }}>
                    <TableCell sx={{ fontSize: "0.75rem", px: 1 }}>
                      {formatDate(row["Request Date"] as string)}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", px: 1, fontWeight: 500 }}>
                      {row["Hiring Dept"] || "-"}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", px: 1, fontWeight: 500 }}>
                      {row["Designation"] || "-"}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.7rem", px: 1 }}>
                      {row["Requisitioner"] || "-"}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center", px: 1 }}>
                      <Chip
                        label={extractJoiningDays(row["Joining Days"] as string)}
                        size="small"
                        sx={{ fontSize: "0.65rem", height: 20 }}
                      />
                    </TableCell>
                    <TableCell sx={{ px: 1 }}>
                      <Chip
                        label={row["Hiring Status"] || "Pending"}
                        size="small"
                        sx={{
                          fontSize: "0.65rem",
                          height: 20,
                          bgcolor:
                            row["Hiring Status"] === "Joined" ? "#2E7D32" : "#B0BEC5",
                          color: "#fff",
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: "center", px: 1 }}>
                      <Chip
                        label={row["FMS Status"] || "Open"}
                        size="small"
                        sx={{
                          fontSize: "0.65rem",
                          height: 20,
                          bgcolor: getFMSColor(row["FMS Status"] as string),
                          color: "#fff",
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: "center", px: 1 }}>
                      <Chip
                        label={row["FMS Score"] || "N/A"}
                        size="small"
                        sx={{
                          fontSize: "0.65rem",
                          height: 20,
                          bgcolor: "#9E9E9E",
                          color: "#fff",
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ px: 1, textAlign: "center" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={() => handleViewCandidates(row["Designation"] as string)}
                        sx={{ fontSize: "0.65rem", py: 0.3 }}
                      >
                        View (
                        {
                          candidates.filter(
                            (c) => c.Position === row["Designation"]
                          ).length
                        }
                        )
                      </Button>
                    </TableCell>
                    <TableCell sx={{ px: 1 }}>
                      <Tooltip title="View Applicants">
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/requisition/${row["Ser"]}`}
                          color="primary"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(row)} color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* EDIT DIALOG */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ bgcolor: "#f8f9fa", fontWeight: 600 }}>
            Edit Requisition
            <IconButton
              onClick={() => setEditOpen(false)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            {selectedReq && (
              <Box sx={{ display: "grid", gap: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {selectedReq["Designation"]} - {selectedReq["Hiring Dept"]}
                </Typography>
                <TextField
                  label="Max Days"
                  type="number"
                  value={formData.joiningDays}
                  onChange={(e) =>
                    setFormData({ ...formData, joiningDays: Number(e.target.value) })
                  }
                  fullWidth
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <Typography sx={{ ml: 1 }}>days</Typography>
                    ),
                  }}
                />
                <TextField
                  label="Budget (LPA)"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Assigned To"
                  value={formData.assignedTo}
                  onChange={(e) =>
                    setFormData({ ...formData, assignedTo: e.target.value })
                  }
                  fullWidth
                  size="small"
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setEditOpen(false)} startIcon={<CloseIcon />}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              disabled={saving}
            >
              {saving ? (
                <>
                  <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* CANDIDATE MODAL */}
        <Dialog open={candidateModalOpen} onClose={() => setCandidateModalOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ bgcolor: "#f8f9fa", fontWeight: 600, pb: 1 }}>
            Candidates for: <strong>{selectedDesignation}</strong> ({candidates.length})
            <IconButton
              onClick={() => setCandidateModalOpen(false)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <Paper sx={{ p: 1.5, borderBottom: "1px solid #eee" }}>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Search Name/Email"
                    size="small"
                    fullWidth
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select value={modalStatus} onChange={(e) => setModalStatus(e.target.value as string)}>
                      <MenuItem value="">
                        <em>All</em>
                      </MenuItem>
                      <MenuItem value="Applied">Applied</MenuItem>
                      <MenuItem value="Shortlisted">Shortlisted</MenuItem>
                      <MenuItem value="Rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <DatePicker
                    label="Applied After"
                    value={modalDate}
                    onChange={setModalDate}
                    slotProps={{ textField: { size: "small", fullWidth: true } }}
                    format="DD/MMM"
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Button
                    size="small"
                    fullWidth
                    onClick={() => {
                      setModalSearch("");
                      setModalStatus("");
                      setModalDate(null);
                    }}
                  >
                    Reset
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {loadingCandidates ? (
              <Box sx={{ p: 4, textAlign: "center" }}>
                <CircularProgress />
              </Box>
            ) : filteredCandidates.length === 0 ? (
              <Box sx={{ p: 4, textAlign: "center", color: "#888" }}>
                <Typography>No candidates found.</Typography>
              </Box>
            ) : (
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {["Name", "Email", "Location", "Source", "Applied On", "Status"].map((h) => (
                        <TableCell
                          key={h}
                          sx={{ bgcolor: "#f1f3f5", fontWeight: 700, fontSize: "0.75rem" }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredCandidates.map((c, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ fontSize: "0.8rem" }}>{c.Name || "-"}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>{c.Email || "-"}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>
                          {[c.City, c.State].filter(Boolean).join(", ") || "-"}
                        </TableCell>
                        <TableCell>{c.Source || "-"}</TableCell>
                        <TableCell>{formatDate(c.Timestamp)}</TableCell>
                        <TableCell>
                          <Chip label="Applied" size="small" color="primary" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}