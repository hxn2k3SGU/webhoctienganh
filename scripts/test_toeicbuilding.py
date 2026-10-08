import html
import json
import unittest

from download_toeicbuilding import convert


class SourceConversionTest(unittest.TestCase):
    def convert(self, questions, part=3):
        selection = f'<tr><input name="part_ids[]" value="99"><td>Part {part}</td></tr>'
        page = ''.join('<li data-question="' + html.escape(json.dumps(q), quote=True) + '"></li>' for q in questions)
        return convert({'sourceId': '1', 'title': 'Test', 'category': 'ETS Fixture', 'sourceUrl': 'https://example.com'}, selection, page, {})[0]

    def question(self, **changes):
        return {'id': 1, 'part_id': 99, 'ten': 'Question', 'cau1': '(A) One', 'cau2': '(B) Two',
                'cau3': '(C) Three', 'cau4': '(D) Four', 'cau5': None, 'cau_dung': '(A) One',
                'hinh': None, 'audio': None, 'cauhoi_id': None, 'child': [], **changes}

    def test_shifted_fifth_choice(self):
        result = self.convert([self.question(cau3=None, cau4='(C) Three', cau5='(D) Four', cau_dung='(D) Four')])
        self.assertEqual(result['questions'][0]['options'], ['One', 'Two', 'Three', 'Four'])
        self.assertEqual(result['questions'][0]['answer'], 'D')

    def test_image_labels_remain_valid_and_missing_group_is_recovered(self):
        first = self.question(hinh='123_Q1-3.png', audio='123_1-3.mp3', cau1='(A)', cau_dung='(A)')
        result = self.convert([first, self.question(id=2), self.question(id=3)])
        self.assertEqual(result['questions'][0]['options'][0], 'A')
        self.assertEqual(result['questions'][0]['imageUrl'], result['questions'][2]['imageUrl'])
        self.assertEqual(result['questions'][0]['audioUrl'], result['questions'][2]['audioUrl'])
        self.assertEqual(len(result['listeningPlaylist']), 1)

    def test_duplicate_source_options_preserve_both_accepted_answers(self):
        result = self.convert([self.question(cau3='(B) Two', cau_dung='(B) Two')])
        question = result['questions'][0]
        self.assertEqual(question['acceptedAnswers'], ['B', 'C'])
        self.assertEqual(question['answer'], 'B')
        self.assertTrue(question['sourceWarning'])

    def test_missing_option_is_explicit_without_inventing_text(self):
        result = self.convert([self.question(cau4=None)], part=5)
        self.assertIn('Source missing', result['questions'][0]['options'][3])
        self.assertTrue(result['questions'][0]['sourceIncomplete'])

    def test_equal_text_with_different_labels_accepts_either_choice(self):
        result = self.convert([self.question(cau2='(B) Two', cau3='(C) Two', cau_dung='(C) Two')])
        self.assertEqual(result['questions'][0]['acceptedAnswers'], ['B', 'C'])

    def test_extra_part_two_choice_is_not_imported(self):
        result = self.convert([self.question(cau1='A', cau2='B', cau3='C', cau4='D', cau_dung='B')], part=2)
        self.assertEqual(result['questions'][0]['options'], ['A', 'B', 'C'])
        self.assertEqual(result['questions'][0]['answer'], 'B')


if __name__ == '__main__':
    unittest.main()
