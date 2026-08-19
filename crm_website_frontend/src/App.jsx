import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from "react-hot-toast";
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import AddLead from './pages/AddLead';
import AgentsList from './pages/AgentsList';
import AgentLeads from './pages/AgentLeads';
import Login from './pages/Login';
import LeadDetail from "./pages/LeadDetail";
import Profile from './pages/Profile';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Reports from './pages/Reports';
import GlobalSettings from './pages/GlobalSettings';
import ManagerDashboard from './pages/ManagerDashboard';
import BugReports from './pages/BugReports';
import './index.css';

const API_URL = `${import.meta.env.VITE_API_URL}`;

function App() {
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [products, setProducts] = useState([]);
  const [statuses, setStatuses] = useState([]);
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
        const [leadsRes, agentsRes, configRes, profileRes] = await Promise.all([
          fetch(`${API_URL}/leads`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/agents`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        if (leadsRes.ok && agentsRes.ok && configRes.ok) {
          const leadsData = await leadsRes.json();
          const agentsData = await agentsRes.json();
          const configData = await configRes.json();
          setLeads(leadsData);
          setAgents(agentsData);
          setProducts(configData.products || []);
          setStatuses(configData.statuses || []);

          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setUser(prev => {
              const updated = { ...prev, ...profileData };
              localStorage.setItem('user', JSON.stringify(updated));
              return updated;
            });
          }
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
        // Only admins should see unassigned leads added to their dashboard
        if (user?.isAdmin) {
          setLeads((prev) => [savedLead, ...prev]);
        }
        toast.success("Lead added successfully.");
        return true;
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to add lead: ${errData.error || response.statusText}`);
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

  const refreshAgents = async (agentId) => {
    if (!token) return;
    try {
      if (agentId) {
        const res = await fetch(`${API_URL}/agents/${agentId}/metrics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const metrics = await res.json();
          setAgents((prev) => prev.map(a => {
            if (String(a.id || a._id) === String(agentId)) {
              return {
                ...a,
                monthlyTarget: metrics.monthlyTarget !== undefined ? metrics.monthlyTarget : a.monthlyTarget,
                targetCompleted: metrics.targetCompleted !== undefined ? metrics.targetCompleted : a.targetCompleted,
                bookingCount: metrics.bookingCount !== undefined ? metrics.bookingCount : a.bookingCount,
                targetBookingCount: metrics.targetBookingCount !== undefined ? metrics.targetBookingCount : a.targetBookingCount,
                attendance: metrics.attendance !== undefined ? metrics.attendance : a.attendance,
                historicalMetrics: metrics.historicalMetrics || a.historicalMetrics
              };
            }
            return a;
          }));
          return;
        }
      }

      const agentsRes = await fetch(`${API_URL}/agents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData);
      }
    } catch (e) {
      console.error("Failed to refresh agents:", e);
    }
  };

  const bookLeadAPI = async (leadId, bookingDetails) => {
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}/book`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ bookingDetails }),
      });
      if (response.ok) {
        const updatedLead = await response.json();
        setLeads((prev) => prev.map(lead => lead.id === leadId ? updatedLead : lead));
        (updatedLead?.agentIds || []).forEach(aid => refreshAgents(aid));
        toast.success("Lead booked successfully.");
        return updatedLead;
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to book lead: ${errData.error || response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return null;
    }
  };

  const createBookingAPI = async (formData) => {
    try {
      const response = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success("New booking created successfully");
        refreshAgents();
        const leadId = formData.get('leadId');
        if (leadId) {
          try {
            const leadRes = await fetch(`${API_URL}/leads/${leadId}`, {
              headers: getAuthHeaders()
            });
            if (leadRes.ok) {
              const updatedLead = await leadRes.json();
              setLeads((prev) => prev.map(l => l.id === leadId ? updatedLead : l));
            }
          } catch (e) {
            console.error("Error refreshing lead details:", e);
          }
        }
        return data.data;
      } else {
        toast.error(`Failed to create booking: ${data.error || response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error during booking creation.");
      return null;
    }
  };

  const editBookingAPI = async (bookingId, formData) => {
    try {
      const response = await fetch(`${API_URL}/bookings/${bookingId}/edit`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success("Booking updated successfully!");
        refreshAgents();
        return data.data;
      } else {
        toast.error(`Failed to edit booking: ${data.error || response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error during booking update.");
      return null;
    }
  };

  const getBookingAPI = async (bookingId, options = {}) => {
    try {
      const queryString = new URLSearchParams(options).toString();
      const url = `${API_URL}/bookings/${encodeURIComponent(bookingId)}${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return data.data;
      }
      return null;
    } catch (error) {
      console.error("Error fetching booking:", error);
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

  const updateAgentStatus = async (agentId, status, role) => {
    try {
      const response = await fetch(`${API_URL}/agents/${agentId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, role }),
      });
      if (response.ok) {
        const data = await response.json();
        if (status === 'Rejected') {
          setAgents((prev) => prev.filter(agent => agent.id !== agentId));
          toast.success(data.message || "Agent rejected successfully.");
        } else if (role) {
          setAgents((prev) => prev.map(agent => agent.id === agentId ? data : agent));
          toast.success(`User approved as ${role === 'itinerary' ? 'Itinerary Team' : 'Agent'}.`);
        } else {
          setAgents((prev) => prev.map(agent => agent.id === agentId ? data : agent));
          toast.success(`Agent status updated to ${status}.`);
        }
        return data;
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

  const toggleItineraryRole = async (agentId, isItinerary) => {
    try {
      const response = await fetch(`${API_URL}/agents/${agentId}/toggle-itinerary`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isItinerary }),
      });
      if (response.ok) {
        const updatedAgent = await response.json();
        setAgents((prev) => prev.map(agent => agent.id === agentId ? updatedAgent : agent));
        toast.success(isItinerary ? `${updatedAgent.name} is now Itinerary Team.` : `${updatedAgent.name} is now Agent.`);
        return updatedAgent;
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to update itinerary role: ${errData.error || response.statusText}`);
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

  const updateAgentMetrics = async (agentId, metrics) => {
    try {
      const response = await fetch(`${API_URL}/agents/${agentId}/metrics`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(metrics),
      });
      if (response.ok) {
        const updatedAgent = await response.json();
        setAgents((prev) => prev.map(agent => agent.id === agentId ? updatedAgent : agent));
        toast.success("Agent metrics updated successfully.");
        return updatedAgent;
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to update metrics: ${errData.error || response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return null;
    }
  };

  const toggleManagerRole = async (agentId, isManager) => {
    try {
      const response = await fetch(`${API_URL}/agents/${agentId}/toggle-manager`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isManager }),
      });
      if (response.ok) {
        const updatedAgent = await response.json();
        
        // If demoted, refresh the agents list to show that their team members are unassigned
        if (!isManager) {
          const agentsRes = await fetch(`${API_URL}/agents`, { headers: getAuthHeaders() });
          if (agentsRes.ok) {
            const fetchedAgents = await agentsRes.json();
            setAgents(fetchedAgents);
          }
        } else {
          setAgents((prev) => prev.map(agent => agent.id === agentId ? updatedAgent : agent));
        }
        
        toast.success(isManager ? `${updatedAgent.name} is now a Manager.` : `${updatedAgent.name} has been demoted to Agent.`);
        return updatedAgent;
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to update role: ${errData.error || response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection error.");
      return null;
    }
  };

  const assignAgentsToManager = async (managerId, agentIds) => {
    try {
      const response = await fetch(`${API_URL}/agents/${managerId}/assign-agents`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ agentIds }),
      });
      if (response.ok) {
        const result = await response.json();
        // Refresh agents list to reflect new managerId assignments
        const agentsRes = await fetch(`${API_URL}/agents`, { headers: getAuthHeaders() });
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          setAgents(agentsData);
        }
        toast.success(`Team updated: ${result.agents.length} agent(s) assigned.`);
        return result;
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Failed to assign agents: ${errData.error || response.statusText}`);
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
              <Route path="/register" element={<Register API_URL={API_URL} setToken={setToken} setUser={setUser} />} />
              <Route path="/forgot-password" element={<ForgotPassword API_URL={API_URL} />} />
              <Route path="/reset-password" element={<ResetPassword API_URL={API_URL} setToken={setToken} setUser={setUser} />} />
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
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} user={user} handleLogout={handleLogout} agents={agents} />
        <Toaster position='top-center' />
        <main>
          <Routes>
            <Route
              path="/"
              element={<Dashboard leads={leads} agents={agents} products={products} statuses={statuses} assignAgent={assignAgent} addNote={addNote} deleteNote={deleteNote} updateLead={updateLead} updateLeadStatus={updateLeadStatus} updateLeadBooking={updateLeadBooking} user={user} loading={loadingData} />}
            />

            <Route
              path="/add-lead"
              element={user?.isItinerary ? <Navigate to="/" replace /> : <AddLead addLead={addLead} user={user} products={products} />}
            />
            <Route
              path="/settings"
              element={user?.isAdmin ? <GlobalSettings products={products} setProducts={setProducts} statuses={statuses} setStatuses={setStatuses} API_URL={API_URL} token={token} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/agents"
              element={user?.isAdmin ? <AgentsList agents={agents} leads={leads} updateAgentStatus={updateAgentStatus} updateAgentVerification={updateAgentVerification} updateAgentMetrics={updateAgentMetrics} toggleManagerRole={toggleManagerRole} toggleItineraryRole={toggleItineraryRole} assignAgentsToManager={assignAgentsToManager} loading={loadingData} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/agents/:id"
              element={(user?.isAdmin || user?.isManager) ? <AgentLeads leads={leads} agents={agents} statuses={statuses} updateAgentMetrics={updateAgentMetrics} refreshAgents={refreshAgents} loading={loadingData} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/manager-dashboard"
              element={user?.isManager && !user?.isAdmin ? <ManagerDashboard user={user} token={token} leads={leads} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/reports"
              element={user?.isAdmin ? <Reports leads={leads} agents={agents} /> : <Navigate to="/" replace />}
            />

            <Route
              path="/leads/:id"
              element={<LeadDetail 
                      API_URL={API_URL} 
                      token={token} 
                      user={user} 
                      setLeads={setLeads} 
                      leads={leads} 
                      agents={agents} 
                      products={products}
                      statuses={statuses}
                      updateLeadStatus={updateLeadStatus} 
                      bookLeadAPI={bookLeadAPI}
                      createBookingAPI={createBookingAPI}
                      editBookingAPI={editBookingAPI}
                      getBookingAPI={getBookingAPI}
                      updateLeadBooking={updateLeadBooking}
                      assignAgent={assignAgent}
                    />} />
            <Route
              path="/profile"
              element={<Profile user={user} setUser={setUser} token={token} API_URL={API_URL} handleLogout={handleLogout} />} />
            <Route
              path="/bug-reports"
              element={<BugReports token={token} API_URL={API_URL} user={user} />} />
            <Route path="/forgot-password" element={<ForgotPassword API_URL={API_URL} />} />
            <Route path="/reset-password" element={<ResetPassword API_URL={API_URL} setToken={setToken} setUser={setUser} />} />
            {/* Redirect any other path to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
