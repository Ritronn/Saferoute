import { useState, useEffect } from 'react'

const STORAGE_KEY = 'saferoute_community'

const SEED_POSTS = [
  {
    id: '1', author: 'PuneLocal_Priya', area: 'Koregaon Park',
    text: 'Avoid Lane 6 after 11pm — very poorly lit and isolated. Take the main road via North Main Road instead, it has shops open late.',
    votes: 24, time: '2h ago', tag: 'route_tip',
  },
  {
    id: '2', author: 'NightOwl_Rahul', area: 'Hinjewadi',
    text: 'The Wakad-Hinjewadi road is much safer than the highway at night. More street lights and 24/7 dhabas along the way.',
    votes: 18, time: '5h ago', tag: 'route_tip',
  },
  {
    id: '3', author: 'SafeCommuter_22', area: 'Swargate',
    text: '⚠️ Saw a chain-snatching incident near Swargate bus stand yesterday evening. Please be careful and keep phones in bags.',
    votes: 31, time: '1d ago', tag: 'incident',
  },
  {
    id: '4', author: 'WomenSafety_Pune', area: 'Shivajinagar',
    text: 'JM Road is well-lit and busy even at midnight during weekends. Good option for late-night commute from FC Road area.',
    votes: 15, time: '1d ago', tag: 'route_tip',
  },
  {
    id: '5', author: 'BikerDude_Amit', area: 'Katraj',
    text: 'Katraj tunnel stretch has no network coverage. Share your live location BEFORE entering if traveling alone at night.',
    votes: 42, time: '2d ago', tag: 'safety_tip',
  },
  {
    id: '6', author: 'MedStudent_Neha', area: 'Kothrud',
    text: 'Paud Road near Chandani Chowk has police patrol at night now. Feels safer than it used to be 6 months ago.',
    votes: 11, time: '3d ago', tag: 'update',
  },
]

const TAGS = {
  route_tip: { label: 'Route Tip', color: '#059669', bg: '#d1fae5' },
  incident: { label: 'Incident', color: '#dc2626', bg: '#fee2e2' },
  safety_tip: { label: 'Safety Tip', color: '#4f46e5', bg: '#e0e7ff' },
  update: { label: 'Update', color: '#d97706', bg: '#fef3c7' },
}

function loadPosts() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch (_) {}
  // First time — seed with sample posts
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_POSTS))
  return [...SEED_POSTS]
}

function savePosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}

export default function Community() {
  const [posts, setPosts] = useState(() => loadPosts())
  const [showForm, setShowForm] = useState(false)
  const [newPost, setNewPost] = useState({ text: '', area: '', tag: 'route_tip', author: '' })
  const [voted, setVoted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('saferoute_votes') || '{}') } catch { return {} }
  })
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState('all')

  const handleVote = (postId, dir) => {
    if (voted[postId]) return
    const updated = posts.map(p =>
      p.id === postId ? { ...p, votes: p.votes + dir } : p
    )
    setPosts(updated)
    savePosts(updated)
    const newVoted = { ...voted, [postId]: dir }
    setVoted(newVoted)
    localStorage.setItem('saferoute_votes', JSON.stringify(newVoted))
  }

  const handleSubmit = () => {
    if (!newPost.text.trim()) return
    const post = {
      id: Date.now().toString(),
      author: newPost.author.trim() || 'Anonymous',
      area: newPost.area.trim() || 'Pune',
      text: newPost.text.trim(),
      votes: 0,
      time: 'Just now',
      tag: newPost.tag,
    }
    const updated = [post, ...posts]
    setPosts(updated)
    savePosts(updated)
    setNewPost({ text: '', area: '', tag: 'route_tip', author: '' })
    setShowForm(false)
  }

  const filteredPosts = filter === 'all' ? posts : posts.filter(p => p.tag === filter)

  return (
    <div className="community">
      <div className="community-header" onClick={() => setExpanded(!expanded)}>
        <span>👥</span>
        <span className="community-title">Community</span>
        <span className="community-count">{posts.length} posts</span>
        <span className="community-toggle">{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <>
          {/* Filters */}
          <div className="community-filters">
            {['all', ...Object.keys(TAGS)].map(t => (
              <button
                key={t}
                className={`community-filter ${filter === t ? 'active' : ''}`}
                onClick={() => setFilter(t)}
              >
                {t === 'all' ? 'All' : TAGS[t].label}
              </button>
            ))}
          </div>

          {/* New Post Button / Form */}
          {!showForm ? (
            <button className="community-new-btn" onClick={() => setShowForm(true)}>
              ✍️ Share a Route Tip
            </button>
          ) : (
            <div className="community-form">
              <input
                type="text"
                placeholder="Your name (optional)"
                value={newPost.author}
                onChange={e => setNewPost({ ...newPost, author: e.target.value })}
                className="community-input"
              />
              <input
                type="text"
                placeholder="Area (e.g. Koregaon Park)"
                value={newPost.area}
                onChange={e => setNewPost({ ...newPost, area: e.target.value })}
                className="community-input"
              />
              <div className="community-tag-select">
                {Object.entries(TAGS).map(([key, tag]) => (
                  <button
                    key={key}
                    className={`community-tag-btn ${newPost.tag === key ? 'active' : ''}`}
                    onClick={() => setNewPost({ ...newPost, tag: key })}
                    style={{ '--tag-color': tag.color, '--tag-bg': tag.bg }}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Share your safety tip, route advice, or incident report..."
                value={newPost.text}
                onChange={e => setNewPost({ ...newPost, text: e.target.value })}
                className="community-textarea"
                rows={3}
              />
              <div className="community-form-actions">
                <button className="community-cancel" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="community-submit" onClick={handleSubmit} disabled={!newPost.text.trim()}>Post</button>
              </div>
            </div>
          )}

          {/* Posts Feed */}
          <div className="community-feed">
            {filteredPosts.map(post => {
              const tag = TAGS[post.tag] || TAGS.route_tip
              return (
                <div key={post.id} className="community-post">
                  <div className="community-votes">
                    <button
                      className={`vote-btn ${voted[post.id] === 1 ? 'voted-up' : ''}`}
                      onClick={() => handleVote(post.id, 1)}
                      disabled={!!voted[post.id]}
                    >▲</button>
                    <span className="vote-count">{post.votes}</span>
                    <button
                      className={`vote-btn ${voted[post.id] === -1 ? 'voted-down' : ''}`}
                      onClick={() => handleVote(post.id, -1)}
                      disabled={!!voted[post.id]}
                    >▼</button>
                  </div>
                  <div className="community-post-content">
                    <div className="community-post-meta">
                      <span className="community-author">{post.author}</span>
                      <span className="community-area">📍 {post.area}</span>
                      <span className="community-time">{post.time}</span>
                    </div>
                    <span className="community-tag" style={{ color: tag.color, background: tag.bg }}>
                      {tag.label}
                    </span>
                    <p className="community-post-text">{post.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
