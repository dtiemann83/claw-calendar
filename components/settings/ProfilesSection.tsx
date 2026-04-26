"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Check, X, Plus } from "lucide-react"

interface Profile {
  id: string
  name: string
  color: string
  createdAt: number
}

const COLOR_OPTIONS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
]

function iconBtnStyle(color?: string): React.CSSProperties {
  return {
    background: color ? `${color}33` : "rgba(255,255,255,0.07)",
    border: `1px solid ${color ? `${color}55` : "rgba(255,255,255,0.12)"}`,
    borderRadius: 6,
    color: color ?? "rgba(255,255,255,0.7)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
  }
}

export function ProfilesSection() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const router = useRouter()

  const load = useCallback(() => {
    fetch("/api/profiles").then(r => r.json()).then(setProfiles).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (p: Profile) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditColor(p.color)
    setConfirmDeleteId(null)
  }

  const cancelEdit = () => { setEditingId(null) }

  const saveEdit = async (id: string) => {
    await fetch(`/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    })
    setEditingId(null)
    load()
  }

  const deleteProfile = async (id: string) => {
    await fetch(`/api/profiles/${id}`, { method: "DELETE" })
    setConfirmDeleteId(null)
    load()
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Family Members</h2>
        <button
          onClick={() => router.push("/profiles/new")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(59,130,246,0.6)",
            border: "1px solid rgba(59,130,246,0.4)",
            borderRadius: 8,
            color: "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "0.82rem",
            padding: "6px 14px",
          }}
        >
          <Plus size={14} />
          Add member
        </button>
      </div>

      {profiles.length === 0 && (
        <p style={{ opacity: 0.45, fontSize: "0.88rem" }}>No profiles yet. Add a family member to get started.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {profiles.map((p) => {
          const isEditing = editingId === p.id
          const isConfirmingDelete = confirmDeleteId === p.id

          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
              }}
            >
              {/* Color dot / picker */}
              {isEditing ? (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: 56 }}>
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      style={{
                        width: 16, height: 16,
                        borderRadius: "50%",
                        background: c,
                        border: editColor === c ? "2px solid #fff" : "2px solid transparent",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
              )}

              {/* Name */}
              {isEditing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: "0.9rem",
                    padding: "4px 8px",
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(p.id)
                    if (e.key === "Escape") cancelEdit()
                  }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: "0.9rem" }}>{p.name}</span>
              )}

              {/* Actions */}
              {isConfirmingDelete ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "0.78rem", opacity: 0.7 }}>Delete?</span>
                  <button onClick={() => deleteProfile(p.id)} style={iconBtnStyle("#ef4444")} aria-label="Confirm delete">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setConfirmDeleteId(null)} style={iconBtnStyle()} aria-label="Cancel delete">
                    <X size={14} />
                  </button>
                </div>
              ) : isEditing ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => saveEdit(p.id)} style={iconBtnStyle("#22c55e")} aria-label="Save">
                    <Check size={14} />
                  </button>
                  <button onClick={cancelEdit} style={iconBtnStyle()} aria-label="Cancel">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => startEdit(p)} style={iconBtnStyle()} aria-label="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setConfirmDeleteId(p.id)} style={iconBtnStyle()} aria-label="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
