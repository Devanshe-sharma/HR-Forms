import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Box,
  LinearProgress,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  PeopleAlt,
  AssignmentTurnedIn,
  PendingActions,
  Warning,
  TrendingUp,
  AddCircle,
  Visibility,
} from "@mui/icons-material";

interface OnboardingStats {
  total: number;
  open: number;
  closed: number;
  thisWeek: number;
  overdue: number;
}

interface RecentOnboarding {
  _id: string;
  name: string;
  dept: string;
  designation: string;
  joiningStatus: string;
  fmsStatus: string;
  createdAt: string;
  fmsScore: number;
  totalTasks: number;
  doneInTime: number;
}

const OnboardingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<OnboardingStats>({
    total: 0,
    open: 0,
    closed: 0,
    thisWeek: 0,
    overdue: 0,
  });
  const [recentOnboardings, setRecentOnboardings] = useState<RecentOnboarding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL ?? ""}/api/onboarding`);
      
      // Check if response has the expected structure
      if (!response.data?.success) {
        throw new Error("Invalid API response");
      }
      
      const data = response.data.data || [];
      
      // Calculate stats with safe defaults
      const total = data.length;
      const open = data.filter((item: any) => item.fmsStatus === "Open").length;
      const closed = data.filter((item: any) => item.fmsStatus === "Closed").length;
      
      // This week's onboardings
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const thisWeek = data.filter((item: any) => {
        const createdAt = item.createdAt ? new Date(item.createdAt) : null;
        return createdAt && createdAt >= oneWeekAgo;
      }).length;
      
      // Overdue tasks (simplified - you might want to calculate based on plan dates)
      const overdue = data.filter((item: any) => 
        item.fmsStatus === "Open" && (item.fmsScore || 0) < 0
      ).length;

      setStats({ total, open, closed, thisWeek, overdue });
      
      // Get recent onboardings (last 10) with safe sorting
      const recent = data
        .filter((item: any) => item.createdAt) // Only include items with createdAt
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
      
      setRecentOnboardings(recent);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data");
      // Set empty state on error
      setStats({ total: 0, open: 0, closed: 0, thisWeek: 0, overdue: 0 });
      setRecentOnboardings([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "warning";
      case "Closed":
        return "success";
      case "Joined":
        return "success";
      case "Yet To Join Office":
        return "info";
      case "Not Joining":
        return "error";
      default:
        return "default";
    }
  };

  const getCompletionPercentage = (item: RecentOnboarding) => {
    const totalTasks = item.totalTasks || 0;
    const doneInTime = item.doneInTime || 0;
    if (totalTasks === 0) return 0;
    return Math.round((doneInTime / totalTasks) * 100);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex" }}>
        <Sidebar />
        <Box sx={{ flexGrow: 1 }}>
          <Navbar />
          <Box sx={{ p: 3, marginTop: "56px" }}>
            <LinearProgress />
            <Typography variant="h6" sx={{ mt: 2 }}>Loading dashboard...</Typography>
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
        <Box sx={{ p: 3 }}>
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
      <Box sx={{ 
        display: "flex", 
        flexWrap: "wrap", 
        gap: 3, 
        mb: 3 
      }}>
        <Box sx={{ flex: { xs: "100%", sm: "calc(50% - 12px)", md: "calc(25% - 18px)" } }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <PeopleAlt color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">{stats.total}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Total Onboardings
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: { xs: "100%", sm: "calc(50% - 12px)", md: "calc(25% - 18px)" } }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <PendingActions color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">{stats.open}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Open Onboardings
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: { xs: "100%", sm: "calc(50% - 12px)", md: "calc(25% - 18px)" } }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <AssignmentTurnedIn color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">{stats.closed}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: { xs: "100%", sm: "calc(50% - 12px)", md: "calc(25% - 18px)" } }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Warning color="error" sx={{ mr: 1 }} />
                <Typography variant="h6">{stats.overdue}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Overdue Tasks
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Recent Onboardings Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Recent Onboardings
          </Typography>
          {recentOnboardings.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No onboardings found. Create your first onboarding to get started!
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddCircle />}
                onClick={() => navigate("/new-onboarding")}
                sx={{ mt: 2 }}
              >
                Create First Onboarding
              </Button>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Designation</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentOnboardings.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.dept || "-"}</TableCell>
                    <TableCell>{item.designation || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.joiningStatus}
                        color={getStatusColor(item.joiningStatus) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Box sx={{ width: "100%", mr: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={getCompletionPercentage(item)}
                          />
                        </Box>
                        <Typography variant="body2">
                          {getCompletionPercentage(item)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={item.fmsScore < 0 ? "error" : "success"}
                      >
                        {item.fmsScore}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<Visibility />}
                        onClick={() => {
                          // Navigate to update onboarding page
                          navigate(`/onboarding/update/${item._id}`);
                        }}
                      >
                        Update
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          )}
        </CardContent>
      </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default OnboardingDashboard;
