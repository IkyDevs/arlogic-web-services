"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile, UserRole } from "@/types";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit2,
  Save,
  X,
  UserPlus,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import SearchInput from "@/components/ui/SearchInput";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import NeonButton from "@/components/ui/NeonButton";

export default function RoleManagement() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("customer");
  const [showAddUser, setShowAddUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"full_name" | "email" | "role">(
    "full_name",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    role: "customer" as UserRole,
    password: "",
  });

  const supabase = createClient();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isTablet = useMediaQuery("(min-width: 769px) and (max-width: 1024px)");

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterAndSortUsers();
  }, [users, searchQuery, sortField, sortDirection]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch users");
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }, []);

  const filterAndSortUsers = useCallback(() => {
    let filtered = [...users];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.role.toLowerCase().includes(query),
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === "role") {
        const roleOrder: Record<string, number> = {
          admin: 0,
          owner: 1,
          supervisor: 2,
          teknisi: 3,
          customer: 4,
        };
        aVal = roleOrder[a.role] ?? 99;
        bVal = roleOrder[b.role] ?? 99;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredUsers(filtered);
  }, [users, searchQuery, sortField, sortDirection]);

  const updateUserRole = useCallback(
    async (userId: string, newRole: UserRole) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) {
        toast.error("Failed to update role");
      } else {
        toast.success("Role updated successfully");
        fetchUsers();
        setEditingUser(null);
      }
    },
    [fetchUsers],
  );

  const addNewUser = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!newUser.email || !newUser.password || !newUser.full_name) {
        toast.error('All fields are required')
        return
      }

      if (newUser.password.length < 6) {
        toast.error('Password must be at least 6 characters')
        return
      }

      const loadingToast = toast.loading('Creating user...')

      try {
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newUser.email,
            password: newUser.password,
            full_name: newUser.full_name,
            role: newUser.role,
          }),
        })

        const result = await res.json()

        if (!res.ok) {
          throw new Error(result.error || 'Failed to create user')
        }

        toast.success(`User ${newUser.full_name} created successfully!`, { id: loadingToast })
        setShowAddUser(false)
        setNewUser({ email: '', full_name: '', role: 'customer', password: '' })
        fetchUsers()
      } catch (err: any) {
        toast.error(err.message || 'Failed to create user', { id: loadingToast })
      }
    },
    [newUser, fetchUsers],
  )

  const roles: UserRole[] = [
    "admin",
    "teknisi",
    "supervisor",
    "owner",
    "customer",
  ];

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            User Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage user roles and permissions
          </p>
        </div>
        <NeonButton size="sm" onClick={() => setShowAddUser(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </NeonButton>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            onSearch={setSearchQuery}
            placeholder="Search by name, email, or role..."
            debounceMs={200}
          />
        </div>
      </div>

      {/* Users Grid/Card View for Mobile */}
      {isMobile ? (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.02 }}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {user.full_name}
                    </h3>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-red-100 text-red-700"
                        : user.role === "owner"
                          ? "bg-yellow-100 text-yellow-700"
                          : user.role === "supervisor"
                            ? "bg-green-100 text-green-700"
                            : user.role === "teknisi"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setEditingUser(user.id);
                      setSelectedRole(user.role);
                    }}
                    className="text-blue-600 hover:text-blue-700 p-2"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        /* Table View for Desktop */
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort("full_name")}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Name
                      {sortField === "full_name" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort("email")}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Email
                      {sortField === "email" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort("role")}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Role
                      {sortField === "role" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <AnimatePresence>
                  {filteredUsers.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: index * 0.01 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">
                        {user.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUser === user.id ? (
                          <select
                            value={selectedRole}
                            onChange={(e) =>
                              setSelectedRole(e.target.value as UserRole)
                            }
                            className="border rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          >
                            {roles.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.role === "admin"
                                ? "bg-red-100 text-red-700"
                                : user.role === "owner"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : user.role === "supervisor"
                                    ? "bg-green-100 text-green-700"
                                    : user.role === "teknisi"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUser === user.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                updateUserRole(user.id, selectedRole)
                              }
                              className="text-green-600 hover:text-green-700 p-1"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="text-red-600 hover:text-red-700 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingUser(user.id);
                              setSelectedRole(user.role);
                            }}
                            className="text-blue-600 hover:text-blue-700 p-1"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No users found</p>
            </div>
          )}
        </div>
      )}

      {/* Add User Modal - Keep same */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold mb-4">Add New User</h3>
            <form onSubmit={addNewUser} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Full Name"
                value={newUser.full_name}
                onChange={(e) =>
                  setNewUser({ ...newUser, full_name: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({ ...newUser, role: e.target.value as UserRole })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add User
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
