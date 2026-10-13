"""Headless integration checks, screenshots and optional full-capture 4x film.
Run using the Playwright Python environment with --chrome and --ffmpeg paths.
Starts python -m http.server 8793 at the site root unless --external-server.
The video covers the entire capture at 4x, 1280x720 / 30 fps / H.264.
"""
from __future__ import annotations
import argparse
import json
import math
import os
import shutil
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SITE = HERE.parents[3]


def run():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--chrome', type=Path, default=Path.home()/'.cache/ms-playwright/chromium-1243/chrome-linux64/chrome')
    ap.add_argument('--ffmpeg', default='ffmpeg')
    ap.add_argument('--ffprobe', help='Defaults to ffprobe beside ffmpeg')
    ap.add_argument('--video', action='store_true')
    ap.add_argument('--external-server', action='store_true')
    ap.add_argument('--rate', type=float, default=4)
    args = ap.parse_args()
    if not math.isfinite(args.rate) or args.rate <= 0:
        ap.error('--rate must be positive')
    started = time.monotonic()
    ffprobe = args.ffprobe or str(Path(shutil.which(args.ffmpeg) or args.ffmpeg).with_name('ffprobe'))
    if args.video and not shutil.which(ffprobe):
        ap.error('ffprobe is required to verify the encoded video')
    os.nice(max(0, 19-os.getpriority(os.PRIO_PROCESS, 0)))
    if hasattr(os, 'sched_getaffinity'):
        os.sched_setaffinity(0, sorted(os.sched_getaffinity(0))[:4])
    shots = HERE/'shots'
    shots.mkdir(exist_ok=True)
    trajectory = json.loads((HERE/'data/kitchen/trajectory.json').read_text())
    server = None
    report = {'status': 'running', 'console_errors': [], 'page_errors': [], 'failed_responses': [], 'checks': []}
    url = 'http://127.0.0.1:8793/assets/projects/rehearse/replay/rehearse-replay.html'
    try:
        if not args.external_server:
            server = subprocess.Popen([sys.executable, '-m', 'http.server', '8793', '--bind', '127.0.0.1'], cwd=SITE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
            for _ in range(40):
                if server.poll() is not None:
                    raise RuntimeError('Local HTTP server could not start: '+server.stderr.read())
                try:
                    with urllib.request.urlopen(url, timeout=.2) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(.1)
            else:
                raise RuntimeError('Local HTTP server did not become ready')
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=str(args.chrome), headless=True, args=['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--no-sandbox'])
            page = browser.new_page(viewport={'width': 1440, 'height': 1050}, device_scale_factor=1)
            page.set_default_timeout(120000)
            page.on('pageerror', lambda error: report['page_errors'].append(str(error)))
            page.on('console', lambda msg: report['console_errors'].append(msg.text) if msg.type == 'error' else None)
            page.on('response', lambda response: report['failed_responses'].append({'status': response.status, 'url': response.url}) if response.status >= 400 else None)
            page.goto(url, wait_until='networkidle')
            page.wait_for_function('window.replayReady === true')
            page.wait_for_timeout(1000)
            assert page.locator('canvas').count() == 1
            state = page.evaluate('window.replay.getState()')
            assert state['keyframeFrustums'] <= math.ceil(trajectory['duration'])+1
            target_xyz = state['orbitTarget']
            offset = [a-b for a,b in zip(state['cameraPosition'],target_xyz)]
            assert abs(math.degrees(math.atan2(offset[2],math.hypot(*offset[:2])))-22) < 1e-6
            assert math.sqrt(sum(o*o for o in offset)) <= 1.9+1e-6  # orbit stays inside the room
            page.screenshot(path=str(shots/'orbit.png'), full_page=True)
            report['checks'].append('Splat loaded; orbit screenshot saved')
            target = trajectory['keyframes'][len(trajectory['keyframes'])//2]['t']
            page.locator('.replay-timeline').evaluate('(el,t)=>{el.value=t;el.dispatchEvent(new Event("input",{bubbles:true}));}', target)
            page.wait_for_function('(t)=>Math.abs(window.replay.getState().t-t)<.001', arg=target)
            page.evaluate('(t)=>window.replay.seek(t)', target)
            state = page.evaluate('window.replay.getState()')
            assert state['photoLoaded']
            assert abs(state['t']-target) < .001
            report['checks'].append('DOM timeline scrub changes pose, HUD and loaded photo')
            page.locator('button[data-mode=follow]').click()
            page.wait_for_timeout(500)
            state = page.evaluate('window.replay.getState()')
            assert state['mode'] == 'follow'
            assert sum((a-b)**2 for a,b in zip(state['position'],state['cameraPosition'])) < 1e-16
            x,y,z,w = state['quaternion']
            expected = [w,z,-y,-x]  # q_cv * (1, 0, 0, 0)
            assert abs(abs(sum(a*b for a,b in zip(expected,state['cameraQuaternion'])))-1) < 1e-10
            page.screenshot(path=str(shots/'follow.png'), full_page=True)
            page.locator('.blend').evaluate('(el)=>{el.value="0.5";el.dispatchEvent(new Event("input",{bubbles:true}));}')
            assert page.evaluate('window.replay.getState().blend') == .5
            page.screenshot(path=str(shots/'follow-blend.png'), full_page=True)
            report['checks'].append('Follow camera position and rotation match 6DoF pose; photo blend works')
            page.locator('.play').click()
            page.wait_for_timeout(400)
            page.locator('.play').click()
            assert page.evaluate('window.replay.getState().t') > target
            assert not page.evaluate('window.replay.getState().playing')
            report['checks'].append('Play advances source time; pause stops playback')
            page.locator('.replay-actions select').select_option('4')
            assert page.evaluate('window.replay.getState().rate') == 4
            page.evaluate('(t)=>window.replay.seek(t)', trajectory['end_t'])
            page.locator('.play').click()
            page.wait_for_timeout(150)
            page.locator('.play').click()
            assert page.evaluate('window.replay.getState().t') < trajectory['start_t']+3
            report['checks'].append('Speed selection and restart at end work')
            page.locator('button[data-mode=orbit]').click()
            page.locator('button[data-action=reset]').click()
            assert page.evaluate('window.replay.getState().mode') == 'orbit'
            report['checks'].append('Orbit/reset view at 22 degrees, capped inside the room; sparse frustums')
            page.set_viewport_size({'width':390, 'height':900})
            page.wait_for_timeout(300)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(shots/'mobile.png'), full_page=True)
            report['checks'].append('Mobile layout fits viewport')
            assert not report['console_errors'] and not report['page_errors'] and not report['failed_responses'], report
            if args.video:
                page.set_viewport_size({'width':1280, 'height':720})
                page.goto(url+'?capture=1', wait_until='networkidle')
                page.wait_for_function('window.replayReady === true')
                page.wait_for_timeout(1000)
                duration = trajectory['duration']/args.rate
                count = math.ceil(duration*30)+1
                bitrate = min(6000000, math.floor(58000000*8/(count/30)*.92))
                destination = HERE/'data/kitchen/replay.mp4'
                temporary = HERE/'data/kitchen/replay.partial.mp4'
                ffmpeg = subprocess.Popen([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-threads', '4', '-filter_threads', '1', '-filter_complex_threads', '1', '-f', 'image2pipe', '-framerate', '30', '-vcodec', 'png', '-i', '-', '-an', '-c:v', 'libx264', '-threads', '4', '-preset', 'fast', '-b:v', str(bitrate), '-maxrate', str(bitrate), '-bufsize', str(bitrate*2), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(temporary)], stdin=subprocess.PIPE)
                try:
                    for i in range(count):
                        capture_time = min(trajectory['end_t'], trajectory['start_t']+i*args.rate/30)
                        phase = .42*math.sin(i/(count-1)*math.tau)
                        page.evaluate('(p)=>window.replay.captureAt(p.t,{orbitPhase:p.phase,playbackRate:p.rate})', {'t':capture_time,'phase':phase,'rate':args.rate})
                        frame = page.screenshot(type='png')
                        ffmpeg.stdin.write(frame)
                        if i in (0,count//2,count-1):
                            (shots/f'film-{i:05d}.png').write_bytes(frame)
                        if i%120 == 0:
                            print(f'Rendered {i+1}/{count}', flush=True)
                    ffmpeg.stdin.close()
                    if ffmpeg.wait() != 0:
                        raise RuntimeError('ffmpeg encode failed')
                finally:
                    if ffmpeg.poll() is None:
                        ffmpeg.terminate()
                        ffmpeg.wait()
                assert temporary.stat().st_size <= 60000000
                encoded = json.loads(subprocess.check_output([ffprobe, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,codec_name,nb_frames:format=duration', '-of', 'json', str(temporary)], text=True))
                stream = encoded['streams'][0]
                assert (stream['width'],stream['height'],stream['r_frame_rate'],stream['codec_name']) == (1280,720,'30/1','h264')
                encoded_duration = float(encoded['format']['duration'])
                assert abs(encoded_duration-count/30) < 1/30
                assert int(stream['nb_frames']) == count
                assert not report['console_errors'] and not report['page_errors'] and not report['failed_responses'], report
                temporary.replace(destination)
                report['video'] = {'width':1280,'height':720,'fps':30,'codec':'H.264','frames':count,'duration':encoded_duration,'capture_rate':args.rate,'bytes':destination.stat().st_size}
            assert not report['console_errors'] and not report['page_errors'] and not report['failed_responses'], report
            page.evaluate('window.replay.dispose()')
            assert page.locator('canvas').count() == 0
            report['checks'].append('Dispose releases mounted canvas')
            browser.close()
        report['status'] = 'passed'
    except Exception as error:
        report['status'] = 'blocked' if 'Operation not permitted' in str(error) else 'failed'
        report['error'] = str(error).replace(str(HERE), '<replay>').replace(str(Path.home()), '<home>')
        raise
    finally:
        if server and server.poll() is None:
            server.terminate()
            server.wait()
        report['wall_time_s'] = round(time.monotonic()-started, 3)
        report['cpu_affinity_limit'] = 4
        (shots/'browser-test.json').write_text(json.dumps(report, indent=2)+'\n')


if __name__ == '__main__':
    run()
