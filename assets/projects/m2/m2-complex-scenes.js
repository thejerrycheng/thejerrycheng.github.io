(() => {
  const data = window.M2ComplexScenes;
  const host = document.getElementById('complex-planner');
  if (!data?.clips?.length || !host) return;
  // Keep the public planner grounded in measured contact runs. Welded or
  // purely geometric clips are useful for development, but should not appear
  // in the user-facing rollout flow.
  data.clips = data.clips.filter(c => c.physical_grasp_before_route && c.welded_fallback !== true);
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
    const target = { type: 'scatter3d', mode: 'markers', name: 'Target pose', x: [s.target_xyz[0]], y: [s.target_xyz[1]], z: [s.target_xyz[2]], marker: { color: '#e89916', size: 7, symbol: 'diamond' } };
    Plotly.react(plot, [measured, target], { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { l: 0, r: 0, t: 12, b: 32 }, legend: { orientation: 'h', y: -0.12 }, scene: { aspectmode: 'data', xaxis: { title: 'X · m' }, yaxis: { title: 'Y · m' }, zaxis: { title: 'Z · m' } } }, { responsive: true, displayModeBar: false });
  }
  video.addEventListener('play', () => document.querySelectorAll('video').forEach(v => { if (v !== video) v.pause(); }));
  draw();
})();
