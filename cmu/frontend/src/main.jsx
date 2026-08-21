import React, {useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {
  BrowserRouter, Routes, Route, Navigate, Link,
  useNavigate, useLocation, useParams
} from "react-router-dom";
import {api, clearAuth} from "./api";
import "./styles.css";
import logo from "./assets/cmu-elect-logo.png";
import cmu from "./assets/image-removebg-preview 1.png";
import cover from "./assets/cover blue.png";
import emailIcon from "./assets/Email.png";
import lockIcon from "./assets/Lock.png";
import studentIcon from "./assets/Student Male@2x.png";
import teacherIcon from "./assets/Teacher.png";
import chartIcon from "./assets/chart.png";
import profileIcon from "./assets/Profile.png";
import dashboardBg from "./assets/grey cover.png";

const DEMO = {
  student: {email: "student@cmu.edu", password: "DemoPass123!"},
  alumni: {email: "alumni@cmu.edu", password: "DemoPass123!"},
  faculty: {email: "faculty@cmu.edu", password: "DemoPass123!"},
};

function RequireAuth({children}) {
  return localStorage.getItem("token") ? children : <Navigate to="/login" replace />;
}

function AuthShell({children}) {
  return (
    <div
      className="auth-page"
      style={{backgroundImage: `url("${cover}")`}}
    >
      <section className="auth-brand">

        <div className="brand-logos">
          <img src={logo} className="brand-elect" />
          <img src={cmu} className="brand-cmu" />
        </div>

        <h1>CMU-ELECT</h1>

        <p>
          There's nothing better than being transparent to the people.
        </p>

      </section>

      {children}
    </div>
  );
}

function AuthCard({title, children, backToLogin=true}) {
  return <section className="auth-card">
    <h1>{title}</h1>
    {children}
    {backToLogin && <Link className="back-login" to="/login">← back to login</Link>}
  </section>;
}

function Login() {
  const nav = useNavigate();
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState(DEMO.student.email);
  const [password, setPassword] = useState(DEMO.student.password);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function chooseRole(nextRole) {
    setRole(nextRole);
    setEmail(DEMO[nextRole].email);
    setPassword(DEMO[nextRole].password);
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api("/auth/login/", {
        method: "POST",
        body: JSON.stringify({email, password, role}),
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      nav("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return <AuthShell>
    <form className="auth-card login-card" onSubmit={submit}>
      <h1>Welcome!</h1>
      <p>Sign in to cast your voice and become an instrument for change.</p>
      <h3>Are you a/an?</h3>
      <div className="role-buttons">
        {Object.keys(DEMO).map(r => <button
          type="button"
          key={r}
          className={`role role-${r} ${role === r ? "selected" : ""}`}
          onClick={() => chooseRole(r)}
        >{r[0].toUpperCase() + r.slice(1)}</button>)}
      </div>

      <label>CMU Email</label>
      <div className="input-wrap">
        <img src={emailIcon} />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>

      <label>Password</label>
      <div className="input-wrap">
        <img src={lockIcon} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>

      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={loading}>{loading ? "Signing In..." : "Sign In"}</button>
      <Link className="forgot-link" to="/forgot-password">Forgot Password?</Link>
    </form>
  </AuthShell>;
}

function ForgotPassword() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [devCode, setDevCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    try {
      const data = await api("/auth/forgot-password/", {
        method: "POST", body: JSON.stringify({email})
      });
      setDevCode(data.dev_code || "");
      setMessage(data.detail);
      setStep("code");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function verifyCode(e) {
    e.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    try {
      const data = await api("/auth/verify-code/", {
        method: "POST", body: JSON.stringify({email, code})
      });
      setResetToken(data.reset_token);
      setStep("password");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function resendCode() {
    setError(""); setMessage("");
    try {
      const data = await api("/auth/resend-code/", {
        method: "POST", body: JSON.stringify({email})
      });
      setDevCode(data.dev_code || "");
      setMessage("A new verification code was sent.");
    } catch (err) { setError(err.message); }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    try {
      await api("/auth/reset-password/", {
        method: "POST",
        body: JSON.stringify({email, reset_token: resetToken, password, confirm_password: confirmPassword})
      });
      setStep("done");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (step === "done") return <AuthShell>
    <AuthCard title="PASSWORD UPDATED">
      <p className="success-copy">Your password was changed successfully.</p>
      <Link className="primary button-link" to="/login">Back to Login</Link>
    </AuthCard>
  </AuthShell>;

  if (step === "code") return <AuthShell>
    <AuthCard title="VERIFICATION">
      <p className="small-label">ENTER VERIFICATION CODE</p>
      <form onSubmit={verifyCode}>
        <input className="code-input" inputMode="numeric" maxLength="6" value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" required />
        <p className="resend-copy">If you didn't receive a code. <button type="button" onClick={resendCode}>Resend</button></p>
        {devCode && <div className="dev-code">Development code: <b>{devCode}</b></div>}
        {message && <div className="info">{message}</div>}
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={loading}>{loading ? "Verifying..." : "Verify"}</button>
      </form>
    </AuthCard>
  </AuthShell>;

  if (step === "password") return <AuthShell>
    <AuthCard title="NEW PASSWORD">
      <form onSubmit={resetPassword}>
        <label>enter your new password</label>
        <div className="input-wrap"><img src={lockIcon}/><input type="password" minLength="8" value={password} onChange={e=>setPassword(e.target.value)} placeholder="at least 8 characters" required /></div>
        <label>confirm your new password</label>
        <div className="input-wrap"><img src={lockIcon}/><input type="password" minLength="8" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="at least 8 characters" required /></div>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={loading}>{loading ? "Saving..." : "Submit"}</button>
      </form>
      <button className="cancel-button" onClick={()=>{setStep("email");setError("")}}>Cancel</button>
    </AuthCard>
  </AuthShell>;

  return <AuthShell>
    <AuthCard title="FORGOT PASSWORD">
      <p className="forgot-copy">Enter your CMU email and we'll send you a verification code.</p>
      <form onSubmit={requestCode}>
        <div className="input-wrap"><img src={emailIcon}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="enter your email" required /></div>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={loading}>{loading ? "Sending..." : "SUBMIT"}</button>
      </form>
    </AuthCard>
  </AuthShell>;
}

function Layout({children}) {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  async function logout() {
    try { await api("/auth/logout/", {method: "POST"}); } catch (_) {}
    clearAuth();
    nav("/login");
  }
  return <>
  <header className="topbar">
  <div className="topbar-brand">
    <img src={logo} alt="CMU-ELECT Logo" />
    <span>CMU-ELECT</span>
  </div>

  <nav>
    <span className="user-chip">{user.email}</span>
    <Link to="/dashboard">Home</Link>
    <button onClick={logout}>Logout</button>
  </nav>
</header>
    {children}
  </>;
}

function Dashboard() {
  const [elections, setElections] = useState([]);
  const [error, setError] = useState("");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    api("/elections/")
      .then(setElections)
      .catch(e => setError(e.message));
  }, []);

  return (
    <Layout>
      <div
        className="dashboard-background"
        style={{
          backgroundImage: `url("${dashboardBg}")`
        }}
      >
        <main className="dashboard">
          <div className="hero">
            <div>
              <h1>{user.role?.toUpperCase()} ELECTIONS</h1>
              <p>Select an election to view positions and cast your vote.</p>
            </div>

            <img
              src={
                user.role === "faculty" || user.role === "alumni"
                  ? teacherIcon
                  : studentIcon
              }
            />
          </div>

          {error && <div className="error">{error}</div>}

          {elections.map(e => (
            <section className="election-card" key={e.id}>
              <div className="election-heading">
                <div>
                  <h2>{e.name}</h2>
                  <span className={e.is_open ? "open" : "closed"}>
                    {e.is_open ? "OPEN" : "CLOSED"}
                  </span>
                </div>

                <Link
                  className="results-link"
                  to={`/results/${e.id}`}
                >
                  Analytics
                </Link>
              </div>

              <div className="position-grid">
                {e.positions.map(p => (
                  <Link
                    to={`/vote/${e.id}/${p.id}`}
                    className="position"
                    key={p.id}
                  >
                    <span>{p.name}</span>
                    <img src={chartIcon} />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </Layout>
  );
}
function VotePage() {
  const {electionId,positionId}=useParams();
  const [election,setElection]=useState(null),[selected,setSelected]=useState(null),[msg,setMsg]=useState("");
  useEffect(()=>{api("/elections/").then(all=>setElection(all.find(e=>e.id===Number(electionId)))).catch(e=>setMsg(e.message))},[electionId]);
  const position=election?.positions.find(p=>p.id===Number(positionId));
  async function vote(){
    if(!selected) return setMsg("Please select a candidate first.");
    try { await api("/votes/",{method:"POST",body:JSON.stringify({position_id:Number(positionId),candidate_id:selected})}); setMsg("Vote recorded successfully."); }
    catch(e){setMsg(e.message)}
  }
  if(!position) return <Layout><main className="center">Loading...</main></Layout>;
  return <Layout><main className="vote-page"><div className="vote-head"><div><h1>{election.name}</h1><h2>{position.name}</h2></div><Link to="/dashboard" className="secondary">Home</Link></div>
    <div className="candidate-list">{position.candidates.map(c=><article className={`candidate ${selected===c.id?"chosen":""}`} onClick={()=>setSelected(c.id)} key={c.id}><img src={profileIcon}/><div><span className="party">{c.party_list}</span><h2>{c.name}</h2><p>{c.department}</p><p><b>Platform:</b> {c.platform}</p>{c.gwa&&<p><b>GWA:</b> {c.gwa}</p>}</div><button onClick={e=>{e.stopPropagation();setSelected(c.id)}}>{selected===c.id?"Selected":"Vote"}</button></article>)}</div>
    {msg&&<div className="message">{msg}</div>}<button className="submit-vote" onClick={vote}>SUBMIT VOTE</button>
  </main></Layout>;
}

function Results() {
  const {electionId}=useParams(); const [data,setData]=useState(null); const [error,setError]=useState("");
  useEffect(()=>{api(`/elections/${electionId}/results/`).then(setData).catch(e=>setError(e.message))},[electionId]);
  return <Layout><main className="dashboard"><div className="result-title"><h1>Analytics & Charts</h1><p>Database-backed vote totals for the selected election.</p></div>{error&&<div className="error">{error}</div>}{data?.results.map(r=><section className="result" key={r.position}><h2>{r.position}</h2>{r.candidates.map(c=><div className="bar" key={c.candidate}><span>{c.candidate}</span><b>{c.votes}</b></div>)}</section>)}</main></Layout>;
}

function App(){
  return <Routes>
    <Route path="/login" element={<Login/>}/>
    <Route path="/forgot-password" element={<ForgotPassword/>}/>
    <Route path="/dashboard" element={<RequireAuth><Dashboard/></RequireAuth>}/>
    <Route path="/vote/:electionId/:positionId" element={<RequireAuth><VotePage/></RequireAuth>}/>
    <Route path="/results/:electionId" element={<RequireAuth><Results/></RequireAuth>}/>
    <Route path="*" element={<Navigate to="/login" replace/>}/>
  </Routes>;
}

createRoot(document.getElementById("root")).render(<BrowserRouter><App/></BrowserRouter>);
