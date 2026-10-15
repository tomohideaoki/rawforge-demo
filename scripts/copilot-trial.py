"""One bounded trial. Importing this module never invokes Copilot."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def apply_response(source, response):
    if len(response) > 4096:
        raise ValueError('Response exceeds trial limit')
    data = json.loads(response)
    if not isinstance(data, dict) or set(data) != {'replacement'}:
        raise ValueError('Expected only a replacement field')
    match = re.search(r'<input\b[^>]*\bid="name"[^>]*>', source)
    if not match or 'maxlength' in match.group(0):
        raise ValueError('Trial precondition changed; review task first')
    old = match.group(0)
    # The model can propose exactly one attribute addition, nothing executable.
    expected = old[:-1] + ' maxlength="100">'
    if data['replacement'] != expected:
        raise ValueError('Proposal is outside the approved single-attribute change')
    return source[:match.start()] + expected + source[match.end():]


def main():
    if os.environ.get('COPILOT_FREE_TRIAL_APPROVED') != 'true':
        raise SystemExit('Free-plan and zero-additional-spend verification is required')
    token = os.environ.get('COPILOT_GITHUB_TOKEN', '')
    if not token.startswith('github_pat_'):
        raise SystemExit('A fine-grained Copilot-only PAT is required')
    source = (ROOT / 'index.html').read_text()
    match = re.search(r'<input\b[^>]*\bid="name"[^>]*>', source)
    if not match or 'maxlength' in match.group(0):
        raise SystemExit('Trial task no longer applies; no AI call made')
    prompt = ('Return only a JSON object with exactly one key, replacement. '
              'Improve this child-name HTML input by adding maxlength="100" '
              'immediately before the closing >. Preserve every other character. '
              'Do not use tools. Input: ' + match.group(0))
    with tempfile.TemporaryDirectory(prefix='gp-copilot-') as isolated:
        # No repository, custom instructions, write credential, or provider key
        # is present in the CLI working directory/environment.
        env = {key: os.environ[key] for key in ('PATH', 'HOME', 'LANG') if key in os.environ}
        env.update(COPILOT_GITHUB_TOKEN=token, COPILOT_AUTO_UPDATE='false',
                   COPILOT_HOME=isolated)
        command = ['copilot', '-p', prompt, '-s', '--no-ask-user']
        for tool in ('shell', 'read', 'write', 'url', 'memory', 'github'):
            command.extend(['--deny-tool', tool])
        try:
            result = subprocess.run(command, cwd=isolated, env=env,
                                    capture_output=True, text=True, timeout=120,
                                    check=False)
        except subprocess.TimeoutExpired:
            raise SystemExit('AI timed out; stopped without retry')
        if result.returncode:
            # Do not publish raw provider diagnostics or authentication data.
            raise SystemExit('Copilot failed (authentication, quota, or CLI error); no retry or paid fallback')
        modified = apply_response(source, result.stdout.strip())
    (ROOT / 'index.html').write_text(modified)
    print('Validated proposal: only name input maxlength=100 was added')


if __name__ == '__main__':
    main()
