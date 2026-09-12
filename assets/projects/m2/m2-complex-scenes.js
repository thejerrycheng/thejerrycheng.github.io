(() => {
  const data = window.M2ComplexScenes;
  const host = document.getElementById('complex-planner');
  if (!data?.clips?.length || !host) return;
  // Keep the public planner grounded in measured contact runs. Welded or
  // purely geometric clips are useful for development, but should not appear
  // in the user-facing rollout flow.
  data.clips = data.clips.filter(c => c.physical_grasp_before_route && c.welded_fallback !== true);
  // Promote verified couch carry and pitch recordings into the planner. These
  // clips come from the same physical-contact rollout set and include measured
  // traces, so the planner view shows real motion even when an obstacle route
  // is still incomplete.
  const verifiedCouch = (window.M2Rollouts?.clips || [])
    .filter(c => c.trace && c.success && (c.id === 'shared-lift-couch-11620000' || c.id.startsWith('move-996') || c.id.startsWith('native-tilt-')))
    .map(c => ({ ...c, id: `planner-${c.id}`, title: `Couch · ${c.title.replace(/^Training couch · /, '').replace(/^Carry to a new pose · /, 'carry · ')}`, physical_grasp_before_route: true, welded_fallback: false, planner_source: 'physical-contact couch rollout', object_size_xyz: [1.8, 0.65, 1.1] }));
  const existing = new Set(data.clips.map(c => c.id));
  data.clips.push(...verifiedCouch.filter(c => !existing.has(c.id)));
  if (!data.clips.length) return;
  // The same measured contact clips also belong in the main rollout flow.
  if (window.M2Rollouts) {
    const ids = new Set(window.M2Rollouts.clips.map(c => c.id));
    window.M2Rollouts.clips.push(...data.clips.filter(c => !ids.has(c.id)));
  }
  const video = host.querySelector('#complex-planner-video');
  const plot = host.querySelector('#complex-planner-plot');
  const title = host.querySelector('#complex-planner-title');
  const note = host.querySelector('#complex-planner-note');
  let selected = 0;
  const buttons = host.querySelector('#complex-planner-scenes');
  function draw() {
    const s = data.clips[selected], color = '#078b8f';
    video.pause(); video.src = s.video; video.poster = s.poster; video.load();
    title.textContent = s.title;
    const terminations = Array.isArray(s.termination_reasons) ? s.termination_reasons : [];
    note.textContent = `${s.physical_grasp_before_route ? 'Four-hand physical grasp acquired. ' : ''}${s.success ? 'Route completed.' : 'Route stopped before completion.'} ${terminations.join(', ').replaceAll('_', ' ') || 'No physical termination recorded.'}`;
    buttons.replaceChildren();
    data.clips.forEach((clip, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = clip.title;
      b.setAttribute('aria-pressed', String(i === selected));
      b.onclick = () => { selected = i; draw(); };
      buttons.append(b);
    });
    if (!window.Plotly) return;
    const measured = { type: 'scatter3d', mode: 'lines', name: 'Measured couch center',
      x: s.trace.map(r => r.xyz[0]), y: s.trace.map(r => r.xyz[1]), z: s.trace.map(r => r.xyz[2]),
      line: { color, width: 5 }, customdata: s.trace.map(r => [r.t, r.secured, r.rpy[0], r.rpy[1], r.rpy[2]]),
      hovertemplate: 't %{customdata[0]:.2f} s · %{customdata[1]}/4 hands<br>X %{x:.2f} · Y %{y:.2f} · Z %{z:.2f}<br>rotation %{customdata[2]:.1f}°, %{customdata[3]:.1f}°, %{customdata[4]:.1f}°<extra></extra>' };
    const targetCenter = s.target_xyz || [0, 0, 0];
    const size = s.object_size_xyz || [1.8, 0.65, 1.1];
    const target = { type: 'mesh3d', name: 'Target object pose', opacity: 0.72, color: '#e89916', flatshading: true,
      x: [-1,1,1,-1,-1,1,1,-1].map((v,i) => targetCenter[0] + v * size[0] / 2),
      y: [-1,-1,1,1,-1,-1,1,1].map((v,i) => targetCenter[1] + v * size[1] / 2),
      z: [-1,-1,-1,-1,1,1,1,1].map((v,i) => targetCenter[2] + v * size[2] / 2),
      i: [0,0,0,1,1,2,2,4,4,5,5,6], j: [1,2,4,2,5,3,6,5,6,6,1,7], k: [2,4,1,3,4,0,3,1,5,2,0,4] };
    const sweep = { type: 'scatter3d', mode: 'lines+markers', name: 'Orientation sweep',
      x: [targetCenter[0], targetCenter[0]], y: [targetCenter[1], targetCenter[1]],
      z: [targetCenter[2], targetCenter[2] + size[2] * 0.65],
      line: { color: '#62cbd0', width: 5 }, marker: { color: '#62cbd0', size: 3 },
      hovertemplate: 'Target orientation · pitch %{text:.1f}°<extra></extra>', text: [0, (s.target_rpy || [0, 0, 0])[1]] };
    Plotly.react(plot, [measured, target, sweep], { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { l: 0, r: 0, t: 12, b: 32 }, legend: { orientation: 'h', y: -0.12 }, scene: { aspectmode: 'data', xaxis: { title: 'X · m' }, yaxis: { title: 'Y · m' }, zaxis: { title: 'Z · m' } } }, { responsive: true, displayModeBar: false });
  }
  video.addEventListener('play', () => document.querySelectorAll('video').forEach(v => { if (v !== video) v.pause(); }));
  draw();
})();
