import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from "react-hot-toast";
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import AddLead from './pages/AddLead';
import AgentsList from './pages/AgentsList';
import Login from './pages/Login';
import LeadDetail from "./pages/LeadDetail";
import Profile from './pages/Profile';
import Register from './pages/Register';
import './index.css';

const API_URL = `${import.meta.env.VITE_API_URL}`;

function App() {
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loadingData, setLoadingData] = useState(true);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
  };

  // Fetch all leads and agents on component mount or token update
  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingData(false);
      return;
    }
    async function fetchData() {
      setLoadingData(true);
      try {
        const [leadsRes, agentsRes] = await Promise.all([
          fetch(`${API_URL}/leads`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/agents`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        if (leadsRes.ok && agentsRes.ok) {
          const leadsData = await leadsRes.json();
          const agentsData = await agentsRes.json();
          setLeads(leadsData);
          setAgents(agentsData);
        } else {
          // If token expired or invalid
          if (leadsRes.status === 401 || agentsRes.status === 401) {
            handleLogout();
            toast.error("Session expired. Please log in again.");
          } else {
            toast.error("Failed to load data from server");
          }
        }
      } catch (error) {
        console.error("Fetch error:", error);
        toast.error("Could not connect to backend server");
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, [token]);

  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const addLead = async (newLead) => {
    try {
      const response = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newLead),
      });
      if (response.ok) {
        const savedLead = await response.json();
        setLeads((prev) => [savedLead, ...prev]);
        toast.success("Lead added successfully.");
        return true;
      } else {
        toast.error("Failed to add lead.");
        return false;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return false;
    }
  };

  const assignAgent = async (leadId, agentIds) => {
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}/assign`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ agentIds }),
      });

      if (response.ok) {
        toast.success(agentIds && agentIds.length > 0 ? 'Agent assigned successfully' : 'Lead unassigned successfully');
        const updatedLead = await response.json();
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updatedLead : l)));
        return updatedLead;
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to assign lead: ${errData.error || response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return null;
    }
  };

  const addNote = async (leadId, noteText, imageUrl) => {
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}/notes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: noteText, imageUrl }),
      });
      if (response.ok) {
        const updatedLead = await response.json();
        setLeads((prev) => prev.map(lead => lead.id === leadId ? updatedLead : lead));
        toast.success("Note added successfully.");
        return true;
      } else {
        toast.error("Failed to add note.");
        return false;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return false;
    }
  };

  const deleteNote = async (leadId, noteId) => {
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const updatedLead = await response.json();
        setLeads((prev) => prev.map(lead => lead.id === leadId ? updatedLead : lead));
        toast.success("Note deleted successfully.");
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to delete note: ${errData.error || response.statusText}`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
    }
  };

  const updateLead = async (leadId, updatedLead) => {
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedLead),
      });
      if (response.ok) {
        const savedLead = await response.json();
        setLeads((prev) => prev.map(lead => lead.id === leadId ? savedLead : lead));
        toast.success("Lead updated successfully.");
        return true;
      } else {
        toast.error("Failed to update lead.");
        return false;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return false;
    }
  };

  const updateLeadStatus = async (leadId, status) => {
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        const updatedLead = await response.json();
        setLeads((prev) => prev.map(lead => lead.id === leadId ? updatedLead : lead));
        toast.success("Status updated successfully.");
        return updatedLead;
      } else {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          toast.error("Failed to update status: Route not found. Please make sure your backend server is updated to the latest code and has been restarted.");
        } else {
          toast.error(`Failed to update status: ${errData.error || response.statusText}`);
        }
        return null;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return null;
    }
  };

  const updateLeadBooking = async (leadId, bookingData) => {
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}/booking`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(bookingData),
      });
      if (response.ok) {
        const updatedLead = await response.json();
        setLeads((prev) => prev.map(lead => lead.id === leadId ? updatedLead : lead));
        toast.success("Booking info updated.");
        return updatedLead;
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to update booking info: ${errData.error || response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return null;
    }
  };

  const updateAgentStatus = async (agentId, status) => {
    try {
      const response = await fetch(`${API_URL}/agents/${agentId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        const updatedAgent = await response.json();
        setAgents((prev) => prev.map(agent => agent.id === agentId ? updatedAgent : agent));
        toast.success("Agent status updated successfully.");
        return updatedAgent;
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to update agent status: ${errData.error || response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return null;
    }
  };

  const updateAgentVerification = async (agentId, isVerified) => {
    try {
      const response = await fetch(`${API_URL}/agents/${agentId}/verify`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isVerified }),
      });
      if (response.ok) {
        const updatedAgent = await response.json();
        setAgents((prev) => prev.map(agent => agent.id === agentId ? updatedAgent : agent));
        toast.success("Agent verification status updated.");
        return updatedAgent;
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to update verification: ${errData.error || response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return null;
    }
  };

  // If not logged in, intercept and show Login Page
  if (!token) {
    return (
      <Router>
        <div className="min-h-screen">
          <Navbar darkMode={darkMode} setDarkMode={setDarkMode} user={null} />
          <Toaster position='top-center' />
          <main>
            <Routes>
              <Route path="/register" element={<Register setToken={setToken} setUser={setUser} API_URL={API_URL} />} />
              <Route path="*" element={<Login setToken={setToken} setUser={setUser} API_URL={API_URL} />} />
            </Routes>
          </main>
        </div>
      </Router>
    );
  }

  return (
    <Router>
      <div className="min-h-screen">
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} user={user} handleLogout={handleLogout} />
        <Toaster position='top-center' />
        <main>
          <Routes>
            <Route
              path="/"
              element={<Dashboard leads={leads} agents={agents} assignAgent={assignAgent} addNote={addNote} deleteNote={deleteNote} updateLead={updateLead} updateLeadStatus={updateLeadStatus} updateLeadBooking={updateLeadBooking} user={user} loading={loadingData} />}
            />

            <Route
              path="/add-lead"
              element={user.isAdmin ? <AddLead addLead={addLead} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/agents"
              element={user.isAdmin ? <AgentsList agents={agents} leads={leads} updateAgentStatus={updateAgentStatus} updateAgentVerification={updateAgentVerification} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/leads/:id"
              element={<LeadDetail API_URL={API_URL} token={token} user={user} setLeads={setLeads} leads={leads} agents={agents} updateLeadStatus={updateLeadStatus} updateLeadBooking={updateLeadBooking} assignAgent={assignAgent} />} />
            <Route
              path="/profile"
              element={<Profile user={user} setUser={setUser} token={token} API_URL={API_URL} />} />
            {/* Redirect any other path to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
