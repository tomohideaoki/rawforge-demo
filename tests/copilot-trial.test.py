"""Offline tests only: never start the CLI or contact a service."""
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('trial', Path(__file__).resolve().parents[1] / 'scripts/copilot-trial.py')
trial = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trial)


class TrialTests(unittest.TestCase):
    source = '<html><input id="name" autocomplete="off"><script>safe();</script></html>'

    def test_accepts_only_expected_attribute(self):
        replacement = '<input id="name" autocomplete="off" maxlength="100">'
        changed = trial.apply_response(self.source, json.dumps({'replacement': replacement}))
        self.assertEqual(changed, self.source.replace('<input id="name" autocomplete="off">', replacement))

    def test_rejects_unapproved_responses(self):
        for response in ['not JSON', '{}', '[]', 'x' * 4097,
                         json.dumps({'replacement': '<script>attack()</script>'}),
                         json.dumps({'replacement': '<input id="name" maxlength="200">'}),
                         json.dumps({'replacement': '', 'command': 'run this'})]:
            with self.subTest(response=response[:60]), self.assertRaises((ValueError, TypeError)):
                trial.apply_response(self.source, response)

    def test_rejects_changed_preconditions(self):
        for source in ['<html></html>', '<input id="name" maxlength="100">']:
            with self.subTest(source=source), self.assertRaises(ValueError):
                trial.apply_response(source, '{"replacement":""}')


if __name__ == '__main__':
    unittest.main()
