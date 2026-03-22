import { useState, useEffect } from 'react'

export default function HeatmapToggle({ onToggle, visible }) {
  return (
    <button
      className={`heatmap-toggle ${visible ? 'active' : ''}`}
      onClick={() => onToggle(!visible)}
      title={visible ? 'Hide Crime Heatmap' : 'Show Crime Heatmap'}
    >
      <span className="heatmap-icon">🔥</span>
      <span className="heatmap-label">{visible ? 'Hide Heatmap' : 'Crime Heatmap'}</span>
    </button>
  )
}
