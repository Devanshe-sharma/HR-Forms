import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import {
  Card, CardContent, Typography, Button, Box,
  LinearProgress, Chip, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment, TablePagination,
} from "@mui/material";
import {
  PeopleAlt, AssignmentTurnedIn, PendingActions,
  Warning, AddCircle, Visibility, Search,
} from "@mui/icons-material";

interface OnboardingStats {
  total: number; open: number; closed: number;
  thisWeek: number; overdue: number;
}

interface RecentOnboarding {
  _id: string; name: string; dept: string;
  designation: string; joiningStatus: string;
  fmsStatus: string; createdAt: string;
  fmsScore: number; totalTasks: number; doneInTime: number;
}

const OnboardingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<OnboardingStats>({
    total: 0, open: 0, closed: 0, thisWeek: 0, overdue: 0,
  });
  const [allOnboardings, setAllOnboardings] = useState<RecentOnboarding[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
          `${process.env.API_BASE_URL}/onboarding`
        );
      if (!response.data?.success) throw new Error("Invalid API response");

      const data: RecentOnboarding[] = response.data.data || [];

      const total = data.length;
      const open = data.filter((i) => i.fmsStatus === "Open").length;
      const closed = data.filter((i) => i.fmsStatus === "Closed").length;

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const thisWeek = data.filter((i) => {
        const d = i.createdAt ? new Date(i.createdAt) : null;
        return d && d >= oneWeekAgo;
      }).length;

      const overdue = data.filter(
        (i) => i.fmsStatus === "Open" && (i.fmsScore || 0) < 0
      ).length;

      setStats({ total, open, closed, thisWeek, overdue });

      // Sort newest first — NO slice, keep everything
      const sorted = [...data]
        .filter((i) => i.createdAt)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      setAllOnboardings(sorted);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load dashboard data");
      setStats({ total: 0, open: 0, closed: 0, thisWeek: 0, overdue: 0 });
      setAllOnboardings([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Filter by search ──────────────────────────────────────────────────────
  const filtered = allOnboardings.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.name?.toLowerCase().includes(q) ||
      item.dept?.toLowerCase().includes(q) ||
      item.designation?.toLowerCase().includes(q) ||
      item.joiningStatus?.toLowerCase().includes(q) ||
      item.fmsStatus?.toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const getJoiningChipColor = (status: string) => {
    switch (status) {
      case "Joined": return "success";
      case "Yet To Join Office": return "info";
      case "Not Joining": return "error";
      default: return "default";
    }
  };

  const getFmsChipColor = (status: string) =>
    status === "Closed" ? "success" : "warning";

  const getCompletionPercentage = (item: RecentOnboarding) => {
    if (!item.totalTasks) return 0;
    return Math.round(((item.doneInTime || 0) / item.totalTasks) * 100);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex" }}>
        <Sidebar />
        <Box sx={{ flexGrow: 1 }}>
          <Navbar />
          <Box sx={{ p: 3, marginTop: "56px" }}>
            <LinearProgress />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Loading dashboard...
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex" }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1 }}>
        <Navbar />
        <Box sx={{ p: 3, pt: "80px" }}>

          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography variant="h4" component="h1">
              Onboarding Dashboard
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddCircle />}
              onClick={() => navigate("/new-onboarding")}
            >
              New Onboarding
            </Button>
          </Box>

          {/* Stats Cards */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, mb: 3 }}>
            {[
              { icon: <PeopleAlt color="primary" />, value: stats.total, label: "Total Onboardings" },
              { icon: <PendingActions color="warning" />, value: stats.open, label: "Open" },
              { icon: <AssignmentTurnedIn color="success" />, value: stats.closed, label: "Completed" },
              { icon: <Warning color="error" />, value: stats.overdue, label: "Overdue" },
            ].map((card) => (
              <Box
                key={card.label}
                sx={{ flex: { xs: "100%", sm: "calc(50% - 12px)", md: "calc(25% - 18px)" } }}
              >
                <Card>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      {card.icon}
                      <Typography variant="h6" sx={{ ml: 1 }}>{card.value}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {card.label}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>

          {/* All Onboardings Table */}
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" component="h2">
                  All Onboardings ({filtered.length})
                </Typography>
                <TextField
                  size="small"
                  placeholder="Search name, dept, status…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 280 }}
                />
              </Box>

              {filtered.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    {allOnboardings.length === 0
                      ? "No onboardings found. Create your first one!"
                      : "No results match your search."}
                  </Typography>
                  {allOnboardings.length === 0 && (
                    <Button
                      variant="contained"
                      startIcon={<AddCircle />}
                      onClick={() => navigate("/new-onboarding")}
                      sx={{ mt: 2 }}
                    >
                      Create First Onboarding
                    </Button>
                  )}
                </Box>
              ) : (
                <>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Department</TableCell>
                          <TableCell>Designation</TableCell>
                          <TableCell>Joining Status</TableCell>
                          <TableCell>FMS Status</TableCell>
                          <TableCell>Progress</TableCell>
                          <TableCell>Score</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginated.map((item, idx) => (
                          <TableRow key={item._id} hover>
                            <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                            <TableCell>{item.name || "-"}</TableCell>
                            <TableCell>{item.dept || "-"}</TableCell>
                            <TableCell>{item.designation || "-"}</TableCell>
                            <TableCell>
                              <Chip
                                label={item.joiningStatus || "—"}
                                color={getJoiningChipColor(item.joiningStatus) as any}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={item.fmsStatus || "—"}
                                color={getFmsChipColor(item.fmsStatus) as any}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 140 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Box sx={{ flexGrow: 1 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={getCompletionPercentage(item)}
                                  />
                                </Box>
                                <Typography variant="caption">
                                  {getCompletionPercentage(item)}%
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                color={(item.fmsScore || 0) < 0 ? "error" : "success.main"}
                                fontWeight="bold"
                              >
                                {item.fmsScore ?? 0}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                startIcon={<Visibility />}
                                onClick={() => navigate(`/onboarding/update/${item._id}`)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <TablePagination
                    component="div"
                    count={filtered.length}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                  />
                </>
              )}
            </CardContent>
          </Card>

        </Box>
      </Box>
    </Box>
  );
};

export default OnboardingDashboard;