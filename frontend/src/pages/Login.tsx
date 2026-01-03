import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";
import CutoutTextLoader from "../components/CutoutTextLoader";

const API = import.meta.env.VITE_API_BASE;

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.backgroundColor = "#fff";

    // Check if any users exist to toggle first-time setup
    axios
      .get(`${API}/users-exist/`)
      .then((res) => {
        setIsFirstTime(!res.data.exists); // true if no users
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to check user status");
        setLoading(false);
      });

    return () => {
      document.body.style.backgroundColor = "";
    };
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Username and password are required");
      return;
    }

    try {
      await axios.post(`${API}/setup-user/`, { username, password });
      alert("Account created successfully! Please log in.");
      setIsFirstTime(false);
      setUsername("");
      setPassword("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Account creation failed");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post(`${API}/token/`, { username, password });
      localStorage.setItem("access", res.data.access);
      localStorage.setItem("refresh", res.data.refresh);
      localStorage.setItem("role", res.data.role);
      navigate("/home");
    } catch (err) {
      setError("Invalid username or password");
    }
  };

  if (loading) return <CutoutTextLoader height="100vh" background="white" imgUrl="/imgs/random/11.jpg" />;

  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      {/* Background loader */}
      <CutoutTextLoader height="100vh" background="white" imgUrl="/imgs/random/11.jpg" />

      {/* Foreground login content */}
      <div className="login-wrapper" style={{ ...styles.wrapper, position: "relative", zIndex: 10 }}>
        {/* Left: Form */}
        <div style={styles.left}>
          {isFirstTime ? (
            <form onSubmit={handleCreateUser} style={styles.form}>
              <h2 style={styles.title}>Create Username & Password</h2>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={styles.input}
              />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles.input}
              />
              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={() => setShowPassword(!showPassword)}
                  style={{ marginRight: "8px" }}
                />
                Show Password
              </label>
              <button type="submit" style={styles.button}>
                Create Account
              </button>
              {error && <p style={styles.error}>{error}</p>}
            </form>
          ) : (
            <form onSubmit={handleLogin} style={styles.form}>
              <h2 style={styles.title}>Welcome Back</h2>
              <p style={styles.subtitle}>Please login to continue</p>

              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={styles.input}
              />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles.input}
              />
              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={() => setShowPassword(!showPassword)}
                  style={{ marginRight: "8px" }}
                />
                Show Password
              </label>

              <button type="submit" style={styles.button}>
                Login
              </button>

              <p
                style={{
                  marginTop: "15px",
                  cursor: "pointer",
                  color: "#8A6674",
                  textDecoration: "underline",
                  fontSize: "14px",
                  textAlign: "center",
                }}
                onClick={() => navigate("/forgot-password")}
              >
                Forgot Password?
              </p>

              {error && <p style={styles.error}>{error}</p>}
            </form>
          )}
        </div>

        {/* Right: HR Illustration */}
        <div className="login-right" style={styles.right}>
          <div style={styles.illustration}>
            <img
              src="https://cdn-icons-png.flaticon.com/512/4140/4140048.png"
              alt="HR Illustration"
              style={styles.image}
            />
            <h1 style={styles.heading}>Brisk Olive HR Portal</h1>
            <p style={styles.description}>
              Streamline hiring, onboarding, and employee management with confidence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "flex",
    height: "100vh",
    width: "100%",
    fontFamily: "Segoe UI, sans-serif",
  },
  left: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7E6A9",
  },
  right: {
    flex: 1,
    background: "linear-gradient(to right, #8A6674, #8A6674)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  form: {
    backgroundColor: "#fff",
    padding: "40px 30px",
    borderRadius: "10px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
    width: "100%",
    maxWidth: "400px",
  },
  title: {
    marginBottom: "10px",
    fontSize: "24px",
    fontWeight: "bold",
    color: "#8A6674",
    textAlign: "center",
  },
  subtitle: {
    marginBottom: "30px",
    fontSize: "14px",
    color: "#666",
    textAlign: "center",
  },
  input: {
    width: "85%",
    padding: "12px 15px",
    marginBottom: "20px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "14px",
    outline: "none",
  },
  checkbox: {
    fontSize: "12px",
    color: "#666",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
  },
  button: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#8A6674",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "16px",
    cursor: "pointer",
  },
  error: {
    marginTop: "15px",
    color: "#d9534f",
    fontSize: "14px",
    textAlign: "center",
  },
  illustration: {
    textAlign: "center",
    color: "#fff",
    padding: "40px",
    maxWidth: "400px",
  },
  image: {
    width: "120px",
    marginBottom: "20px",
  },
  heading: {
    fontSize: "28px",
    marginBottom: "10px",
  },
  description: {
    fontSize: "16px",
    lineHeight: "1.4",
  },
};
