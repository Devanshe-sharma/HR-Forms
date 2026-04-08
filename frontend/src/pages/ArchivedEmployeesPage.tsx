import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  CircularProgress,
  Chip,
  TextField,
  InputAdornment,
  Stack,
  Button,
  MenuItem,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  BadgeOutlined as BadgeIcon,
  PeopleAltOutlined as PeopleIcon,
  UnarchiveOutlined as UnarchiveIcon,
} from '@mui/icons-material';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

interface Employee {
  _id: string;
  employee_id: string;
  full_name: string;
  official_email: string;
  personal_email: string;
  mobile: string;
  designation: string;
  department: string;
  photo?: string;
}

interface Department {
  _id: string;
  department: string;
  dept_head_email: string;
  dept_group_email: string;
  Id: number;
  parent_department: string;
  department_type: string;
}

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';

// Consistent avatar color per name initial
const AVATAR_COLORS = [
  ['#DBEAFE', '#1D4ED8'],
  ['#FCE7F3', '#9D174D'],
  ['#D1FAE5', '#065F46'],
  ['#FEF3C7', '#92400E'],
  ['#EDE9FE', '#5B21B6'],
  ['#FFE4E6', '#9F1239'],
  ['#CCFBF1', '#134E4A'],
  ['#FEF9C3', '#713F12'],
];

const getAvatarColors = (name: string): [string, string] => {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx] as [string, string];
};

const getInitials = (name?: string) => {
  if (!name) return 'NA';
  return name.split(' ').map(w => w.charAt(0)).join('').toUpperCase().slice(0, 2);
};

const ArchivedEmployeesPage: React.FC = () => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDesignation, setSelectedDesignation] = useState('');

  useEffect(() => {
    fetchArchivedEmployees();
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE}/departments`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) setDepartments(data.data);
      }
    } catch {
      setDepartments([
        { _id: '1', department: 'Engineering', dept_head_email: '', dept_group_email: '', Id: 1, parent_department: 'Technology', department_type: 'Technical' },
        { _id: '2', department: 'Human Resources', dept_head_email: '', dept_group_email: '', Id: 2, parent_department: 'Administration', department_type: 'Support' },
        { _id: '3', department: 'Design', dept_head_email: '', dept_group_email: '', Id: 3, parent_department: 'Technology', department_type: 'Creative' },
      ]);
    }
  };

  const fetchArchivedEmployees = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      console.log('Fetching archived employees from:', `${API_BASE}/employees/archived`);
      const res = await fetch(`${API_BASE}/employees/archived`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      console.log('Archived employees response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('Archived employees data:', data);
        if (data.success && data.data) {
          setEmployees(data.data.map((emp: any) => ({
            _id: emp._id, employee_id: emp.employee_id, full_name: emp.full_name,
            official_email: emp.official_email, personal_email: emp.personal_email,
            mobile: emp.mobile, designation: emp.designation, department: emp.department,
            photo: emp.photo || undefined,
          })));
        }
      } else {
        console.error('Failed to fetch archived employees:', res.statusText);
      }
    } catch (error) {
      console.error('Error fetching archived employees:', error);
      // Demo data for archived employees
      setEmployees([
        { _id: '4', employee_id: 'EMP004', full_name: 'Sarah Wilson', official_email: 'sarah.w@company.com', personal_email: 'sarah@gmail.com', mobile: '+91 65432 10987', designation: 'Marketing Manager', department: 'Marketing' },
        { _id: '5', employee_id: 'EMP005', full_name: 'David Brown', official_email: 'david.b@company.com', personal_email: 'david@yahoo.com', mobile: '+91 54321 09876', designation: 'QA Engineer', department: 'Engineering' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const unarchiveEmployee = async (employeeId: string) => {
    try {
      const token = localStorage.getItem('token') || '';
      console.log('Attempting to unarchive employee:', employeeId);
      
      const response = await fetch(`${API_BASE}/employees/${employeeId}/unarchive`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      
      console.log('Unarchive response status:', response.status);
      console.log('Unarchive response headers:', response.headers);
      
      // Check if response is HTML (server error page) instead of JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const text = await response.text();
        console.error('Server returned HTML instead of JSON:', text.substring(0, 200));
        alert('Backend server is not running or API endpoint not found. Please start the backend server.');
        return;
      }
      
      // Try to parse as JSON
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        const text = await response.text();
        console.error('Response text:', text.substring(0, 200));
        alert(`Invalid response from server. Status: ${response.status}`);
        return;
      }
      
      console.log('Unarchive response data:', responseData);
      
      if (response.ok) {
        // Remove employee from archived list only if API call succeeded
        setEmployees(prev => prev.filter(emp => emp._id !== employeeId));
        console.log('Employee successfully unarchived and removed from archived list');
      } else {
        console.error('Failed to unarchive employee:', responseData.error || response.statusText);
        alert(`Failed to unarchive employee: ${responseData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error unarchiving employee:', error);
      alert('Error unarchiving employee. Please check your connection and ensure backend server is running.');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q ||
      (emp.full_name?.toLowerCase() || '').includes(q) ||
      (emp.official_email?.toLowerCase() || '').includes(q) ||
      (emp.personal_email?.toLowerCase() || '').includes(q) ||
      (emp.designation?.toLowerCase() || '').includes(q) ||
      (emp.department?.toLowerCase() || '').includes(q) ||
      (emp.employee_id?.toLowerCase() || '').includes(q);
    const matchDept = !selectedDepartment || emp.department === selectedDepartment;
    const matchDesig = !selectedDesignation || emp.designation === selectedDesignation;
    return matchSearch && matchDept && matchDesig;
  });

  const uniqueDesignations = Array.from(new Set(employees.map(e => e.designation).filter(Boolean))).sort();
  const sortedDepartments = [...departments].sort((a, b) => a.department.localeCompare(b.department));
  const sortedFiltered = [...filteredEmployees].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  const hasFilters = !!(searchTerm || selectedDepartment || selectedDesignation);

  const clearFilters = () => {
    setSearchTerm(''); setSelectedDepartment('');
    setSelectedDesignation('');
  };

  const borderColor = isLight ? '#E2E8F0' : 'rgba(255,255,255,0.09)';

  const filterSx = {
    flex: '0 1 155px',
    minWidth: 128,
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      fontSize: '0.8rem',
      backgroundColor: theme.palette.background.paper,
      '& fieldset': { borderColor },
      '&:hover fieldset': { borderColor: theme.palette.primary.main },
    },
    '& .MuiInputBase-input': { py: '6.5px' },
    '& .MuiInputLabel-root': { fontSize: '0.78rem', top: '-3px' },
    '& .MuiInputLabel-shrink': { top: '0px' },
  };

  return (
    <div className="min-h-screen" style={{ background: theme.palette.background.default }}>
      <Sidebar />
      <div className="lg:pl-64">
        <Navbar />
        <main style={{ padding: '24px', paddingTop: '76px' }}>

          {/* Page Header */}
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            mb: 2.5, pb: 2,
            borderBottom: `1px solid ${isLight ? '#E9EEF5' : 'rgba(255,255,255,0.08)'}`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '10px',
                background: `linear-gradient(135deg, #EF4444, #DC2626)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 12px #EF444440`,
                flexShrink: 0,
              }}>
                <PeopleIcon sx={{ color: '#fff', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700} color={theme.palette.text.primary} lineHeight={1.2}>
                  Archived Employees
                </Typography>
                <Typography variant="caption" color={theme.palette.text.secondary}>
                  {employees.length} archived members
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Search + Filters bar */}
          <Box sx={{
            mb: 2.5, p: 1.5, borderRadius: '12px',
            border: `1px solid ${isLight ? '#E9EEF5' : 'rgba(255,255,255,0.08)'}`,
            backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
          }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
              <TextField
                size="small"
                placeholder="Search by name, email, ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  flex: '1 1 200px', minWidth: 160,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px', backgroundColor: theme.palette.background.paper, fontSize: '0.8rem',
                    '& fieldset': { borderColor },
                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                  },
                  '& .MuiInputBase-input': { py: '6.5px' },
                }}
              />

              <TextField select label="Department" size="small" value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)} sx={filterSx}>
                <MenuItem value="" sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}>All</MenuItem>
                {sortedDepartments.map(d => <MenuItem key={d._id} value={d.department} sx={{ fontSize: '0.8rem' }}>{d.department}</MenuItem>)}
              </TextField>

              <TextField select label="Designation" size="small" value={selectedDesignation} onChange={e => setSelectedDesignation(e.target.value)} sx={filterSx}>
                <MenuItem value="" sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}>All</MenuItem>
                {uniqueDesignations.map(d => <MenuItem key={d} value={d} sx={{ fontSize: '0.8rem' }}>{d}</MenuItem>)}
              </TextField>

              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ ml: { sm: 'auto' } }}>
                <Typography variant="caption" color={theme.palette.text.disabled} sx={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                  {sortedFiltered.length} / {employees.length} shown
                </Typography>
                {hasFilters && (
                  <Button variant="outlined" size="small" onClick={clearFilters} sx={{
                    fontSize: '0.72rem', px: 1.2, py: '3px', minWidth: 'unset',
                    borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.2)',
                    color: theme.palette.text.secondary, borderRadius: '6px',
                    '&:hover': { borderColor: theme.palette.error.main, color: theme.palette.error.main, bgcolor: 'transparent' },
                  }}>
                    Clear
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>

          {/* Loading */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' },
              gap: 2,
            }}>
              {sortedFiltered.map(employee => {
                const [avatarBg, avatarText] = getAvatarColors(employee.full_name || 'A');
                return (
                  <Card
                    key={employee._id}
                    sx={{
                      height: '100%',
                      borderRadius: '14px',
                      backgroundColor: theme.palette.background.paper,
                      border: `1.5px solid ${borderColor}`,
                      boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                      transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        boxShadow: `0 4px 20px ${theme.palette.primary.main}20`,
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>

                      {/* Profile header */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, flex: 1 }}>
                          <Avatar
                            src={employee.photo}
                            sx={{
                              width: 46, height: 46, flexShrink: 0,
                              bgcolor: avatarBg, color: avatarText,
                              fontSize: '1rem', fontWeight: 700,
                              border: `2px solid ${borderColor}`,
                            }}
                          >
                            {!employee.photo && getInitials(employee.full_name)}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              fontWeight={600} color={theme.palette.text.primary}
                              sx={{ fontSize: '0.875rem', lineHeight: 1.3, mb: 0.3 }}
                              noWrap
                            >
                              {employee.full_name || 'Unknown'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                              <BadgeIcon sx={{ fontSize: 11, color: theme.palette.text.disabled }} />
                              <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.disabled }}>
                                {employee.employee_id}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        
                        {/* Unarchive Button */}
                        <Box
                          onClick={() => unarchiveEmployee(employee._id)}
                          sx={{
                            cursor: 'pointer',
                            p: 1,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: isLight ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.2)',
                              color: '#22C55E',
                            },
                          }}
                        >
                          <UnarchiveIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
                        </Box>
                      </Box>

                      {/* Chips */}
                      <Stack direction="row" flexWrap="wrap" sx={{ mb: 1.5, gap: '5px' }}>
                        <Chip
                          label={employee.designation || 'No Designation'}
                          size="small"
                          sx={{
                            bgcolor: isLight ? '#EFF6FF' : '#1E3A8A',
                            color: isLight ? '#1D4ED8' : '#93C5FD',
                            fontSize: '0.63rem', fontWeight: 500, height: '20px',
                            border: `1px solid ${isLight ? '#BFDBFE' : '#1E40AF'}`,
                            borderRadius: '5px',
                          }}
                        />
                        <Chip
                          label={employee.department || 'No Dept.'}
                          size="small"
                          sx={{
                            bgcolor: isLight ? '#F0FDF4' : '#14532D',
                            color: isLight ? '#15803D' : '#86EFAC',
                            fontSize: '0.63rem', fontWeight: 500, height: '20px',
                            border: `1px solid ${isLight ? '#BBF7D0' : '#166534'}`,
                            borderRadius: '5px',
                          }}
                        />
                      </Stack>

                      <Divider sx={{ mb: 1.5, borderColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)' }} />

                      {/* Contact rows */}
                      <Stack spacing={1}>
                        {([
                          { icon: <EmailIcon sx={{ fontSize: 13, color: theme.palette.primary.main }} />, label: 'Work email', value: employee.official_email },
                          { icon: <EmailIcon sx={{ fontSize: 13, color: theme.palette.success.main }} />, label: 'Personal email', value: employee.personal_email },
                          { icon: <PhoneIcon sx={{ fontSize: 13, color: theme.palette.warning.main }} />, label: 'Phone', value: employee.mobile },
                        ] as const).map(({ icon, label, value }) => (
                          <Box key={label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Box sx={{ mt: '2px', flexShrink: 0 }}>{icon}</Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: '0.61rem', color: theme.palette.text.disabled, lineHeight: 1.2, mb: '1px' }}>
                                {label}
                              </Typography>
                              <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.primary, wordBreak: 'break-all', lineHeight: 1.3 }}>
                                {value || 'Not provided'}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Stack>

                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}

          {/* Empty state */}
          {!loading && sortedFiltered.length === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, textAlign: 'center' }}>
              <Box sx={{
                width: 72, height: 72, borderRadius: '50%', mb: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                border: `2px dashed ${isLight ? '#CBD5E1' : 'rgba(255,255,255,0.15)'}`,
              }}>
                <PersonIcon sx={{ fontSize: 32, color: theme.palette.text.disabled }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={600} color={theme.palette.text.secondary} mb={0.5}>
                No archived employees found
              </Typography>
              <Typography variant="body2" color={theme.palette.text.disabled}>
                Try adjusting your search or filter criteria
              </Typography>
              {hasFilters && (
                <Button variant="outlined" size="small" onClick={clearFilters}
                  sx={{ mt: 2, borderRadius: '8px', fontSize: '0.78rem' }}>
                  Clear all filters
                </Button>
              )}
            </Box>
          )}

        </main>
      </div>
    </div>
  );
};

export default ArchivedEmployeesPage;
