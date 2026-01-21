import { useState, useEffect, type CSSProperties } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import CutoutTextLoader from '../components/CutoutTextLoader';

const API = import.meta.env.VITE_API_BASE || 'https://hr-forms.onrender.com/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  // const [isFirstTime, setIsFirstTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false); // ← NEW: Loader after login
  const [step, setStep] = useState<'login' | 'setup' | 'forgot' | 'otp' | 'reset'>('login');
  const [forgotUsername, setForgotUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [last4Mobile, setLast4Mobile] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.backgroundColor = '#fff';

    axios
      .get(`${API}/auth/users-exist/`)
      .then((res) => {
        const firstTime = !res.data.exists;
        // setIsFirstTime(firstTime);
        setStep(firstTime ? 'setup' : 'login');
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load. Please try again.');
        setLoading(false);
      });

    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Username and password are required');
      return;
    }

    try {
      await axios.post(`${API}/auth/setup-user/`, { username, password });
      alert('Account created! Please log in.');
      setStep('login');
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Account creation failed');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await axios.post(`${API}/token/`, { username, password });
      localStorage.setItem('access', res.data.access);
      localStorage.setItem('refresh', res.data.refresh);
      localStorage.setItem('role', res.data.role || 'employee');

      // Show loader after successful login
      setLoggingIn(true);

      // Optional: Add small delay for smooth UX
      setTimeout(() => {
        navigate('/home');
      }, 1500); 

    } catch (err: any) {
      setError('Invalid username or password');
    }
  };

  // All other handlers remain the same
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!forgotUsername) {
      setError('Username is required');
      return;
    }

    try {
      const res = await axios.post(`${API}/auth/forgot-password/`, { username: forgotUsername });
      setLast4Mobile(res.data.last_4_mobile || '****');
      setStep('otp');
      alert(`OTP sent to your email. Your mobile ends with ${res.data.last_4_mobile}.`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error sending OTP');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length !== 6) {
      setError('Enter valid 6-digit OTP');
      return;
    }

    try {
      await axios.post(`${API}/auth/otp-verify/`, { username: forgotUsername, otp });
      setStep('reset');
      alert('OTP verified! Now enter new password.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid or expired OTP');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await axios.post(`${API}/auth/reset-password/`, { username: forgotUsername, password: newPassword });
      alert('Password reset successful! You can now log in.');
      setStep('login');
      setForgotUsername('');
      setOtp('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Password reset failed');
    }
  };

  // Show initial loader while checking users-exist
  if (loading) {
    return <CutoutTextLoader height="100vh" background="white" imgUrl="/imgs/random/11.jpg" />;
  }

  // Show loader after successful login
  if (loggingIn) {
    return (
      <CutoutTextLoader
        height="100vh"
        background="white"
        imgUrl="/imgs/random/11.jpg"

      />
    );
  }

  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      <CutoutTextLoader height="100vh" background="white" imgUrl="/imgs/random/11.jpg" />

      <div className="login-wrapper" style={{ ...styles.wrapper, position: "relative", zIndex: 10 }}>
        <div style={styles.left}>
          {step === 'setup' ? (
            <form onSubmit={handleCreateUser} style={styles.form}>
              <h2 style={styles.title}>First-Time Setup</h2>
              <p style={styles.subtitle}>Create your admin username and password</p>
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required style={styles.input} />
              <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={styles.input} />
              <label style={styles.checkbox}>
                <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} style={{ marginRight: "8px" }} />
                Show Password
              </label>
              <button type="submit" style={styles.button}>Create Account</button>
              {error && <p style={styles.error}>{error}</p>}
            </form>
          ) : step === 'login' ? (
            <form onSubmit={handleLogin} style={styles.form}>
              <h2 style={styles.title}>Welcome Back</h2>
              <p style={styles.subtitle}>Please login to continue</p>
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required style={styles.input} />
              <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={styles.input} />
              <label style={styles.checkbox}>
                <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} style={{ marginRight: "8px" }} />
                Show Password
              </label>
              <button type="submit" style={styles.button}>Login</button>
              <p onClick={() => setStep('forgot')} style={{ marginTop: "15px", cursor: "pointer", color: "#8A6674", textDecoration: "underline", fontSize: "14px", textAlign: "center" }}>
                Forgot Password?
              </p>
              {error && <p style={styles.error}>{error}</p>}
            </form>
          ) : step === 'forgot' ? (
            <form onSubmit={handleForgotPassword} style={styles.form}>
              <h2 style={styles.title}>Forgot Password</h2>
              <p style={styles.subtitle}>Enter your username to receive OTP</p>
              <input type="text" placeholder="Username" value={forgotUsername} onChange={(e) => setForgotUsername(e.target.value)} required style={styles.input} />
              <button type="submit" style={styles.button}>Send OTP</button>
              <p onClick={() => setStep('login')} style={{ marginTop: "15px", cursor: "pointer", color: "#8A6674", textDecoration: "underline", fontSize: "14px", textAlign: "center" }}>
                Back to Login
              </p>
              {error && <p style={styles.error}>{error}</p>}
            </form>
          ) : step === 'otp' ? (
            <form onSubmit={handleVerifyOTP} style={styles.form}>
              <h2 style={styles.title}>Verify OTP</h2>
              <p style={styles.subtitle}>Enter the 6-digit OTP sent to your email</p>
              <p style={styles.subtitle}>Mobile hint: Ends with {last4Mobile}</p>
              <input type="text" placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} required style={styles.input} />
              <button type="submit" style={styles.button}>Verify OTP</button>
              <p onClick={() => setStep('forgot')} style={{ marginTop: "15px", cursor: "pointer", color: "#8A6674", textDecoration: "underline", fontSize: "14px", textAlign: "center" }}>
                Resend OTP
              </p>
              {error && <p style={styles.error}>{error}</p>}
            </form>
          ) : step === 'reset' ? (
            <form onSubmit={handleResetPassword} style={styles.form}>
              <h2 style={styles.title}>Reset Password</h2>
              <p style={styles.subtitle}>Enter your new password</p>
              <input type={showPassword ? "text" : "password"} placeholder="New Password (min 8 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required style={styles.input} />
              <label style={styles.checkbox}>
                <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} style={{ marginRight: "8px" }} />
                Show Password
              </label>
              <button type="submit" style={styles.button}>Reset Password</button>
              {error && <p style={styles.error}>{error}</p>}
            </form>
          ) : null}
        </div>

        <div className="login-right" style={styles.right}>
          <div style={styles.illustration}>
            <img src="https://cdn-icons-png.flaticon.com/512/4140/4140048.png" alt="HR Illustration" style={styles.image} />
            <h1 style={styles.heading}>Brisk Olive HR Portal</h1>
            <p style={styles.description}>
              Secure login with OTP recovery. Your mobile ends with last 4 digits for verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    height: '100vh',
    width: '100%',
    fontFamily: 'Segoe UI, sans-serif',
  },
  left: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7E6A9',
  },
  right: {
    flex: 1,
    background: 'linear-gradient(to right, #8A6674, #8A6674)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    backgroundColor: '#fff',
    padding: '40px 30px',
    borderRadius: '10px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    marginBottom: '10px',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#8A6674',
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: '30px',
    fontSize: '14px',
    color: '#666',
    textAlign: 'center',
  },
  input: {
    width: '85%',
    padding: '12px 15px',
    marginBottom: '20px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    fontSize: '14px',
    outline: 'none',
  },
  checkbox: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#8A6674',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
  },
  error: {
    marginTop: '15px',
    color: '#d9534f',
    fontSize: '14px',
    textAlign: 'center',
  },
  illustration: {
    textAlign: 'center',
    color: '#fff',
    padding: '40px',
    maxWidth: '400px',
  },
  image: {
    width: '120px',
    marginBottom: '20px',
  },
  heading: {
    fontSize: '28px',
    marginBottom: '10px',
  },
  description: {
    fontSize: '16px',
    lineHeight: '1.4',
  },
};