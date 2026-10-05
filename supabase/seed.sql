-- Seed Data: Atividade Padrão A1 e Turma de Demonstração

-- 1. Atividade padrão do sistema
insert into atividades (id, professor_id, titulo, nivel, publicada)
values (
  'a0000000-0000-0000-0000-000000000001',
  null,
  'Avaliação Oral – Inglês Iniciante (A1)',
  'A1',
  true
) on conflict (id) do nothing;

-- 2. As 10 Perguntas da Atividade Padrão
insert into perguntas (
  id, atividade_id, secao, ordem, tipo, enunciado, instrucao_pt, imagem_path,
  respostas_esperadas, texto_referencia, foco_avaliacao, dicas, gabarito
) values
(
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Apresentação pessoal',
  1,
  'oral',
  'What is your name?',
  'Diga o seu nome completo ou primeiro nome em inglês.',
  null,
  array['My name is ...', 'I am ...', 'I''m ...', 'It''s ...'],
  'My name is',
  array['pronúncia de "my name is" / "it''s"', 'verbo to be'],
  array['You can say: My name is…'],
  null
),
(
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Apresentação pessoal',
  2,
  'oral',
  'How old are you?',
  'Diga a sua idade em inglês usando uma frase completa.',
  null,
  array['I am ... years old.', 'I''m ... years old.'],
  'I am years old',
  array['números', 'pronúncia de "years"'],
  array['You can say: I am … years old.'],
  null
),
(
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'Apresentação pessoal',
  3,
  'oral',
  'Where are you from?',
  'Diga de onde você é (país ou cidade) em inglês.',
  null,
  array['I am from Brazil.', 'I''m from Brazil.', 'I am from São Paulo.', 'I''m from São Paulo.'],
  'I am from Brazil',
  array['pronúncia de "from"', 'nomes de lugares'],
  array['You can say: I''m from…'],
  null
),
(
  'b0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000001',
  'Família e rotina',
  4,
  'oral',
  'Do you have brothers or sisters?',
  'Responda se você tem irmãos ou irmãs em inglês.',
  null,
  array['Yes, I have a brother.', 'Yes, I have a sister.', 'Yes, I have brothers.', 'No, I don''t.'],
  'Yes I have a brother or No I don''t',
  array['vocabulário de família', 'short answer'],
  array['You can say: Yes, I have… or No, I don''t.'],
  null
),
(
  'b0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000001',
  'Família e rotina',
  5,
  'oral',
  'What time do you wake up?',
  'Diga o horário em que você costuma acordar.',
  null,
  array['I wake up at seven o''clock.', 'I wake up at six o''clock.', 'I wake up at eight o''clock.'],
  'I wake up at seven o''clock',
  array['horas', 'pronúncia de "wake up"'],
  array['You can say: I wake up at…'],
  null
),
(
  'b0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000001',
  'Família e rotina',
  6,
  'oral',
  'What do you do in the morning?',
  'Conte uma ou mais coisas que você faz pela manhã.',
  null,
  array['I have breakfast and I go to school.', 'I brush my teeth and get dressed.', 'I have breakfast.'],
  'I have breakfast and go to school',
  array['verbos de rotina', 'conectores simples (and, then)'],
  array['You can say: In the morning, I…', 'Think about breakfast, school, teeth…'],
  null
),
(
  'b0000000-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-000000000001',
  'Imagens',
  7,
  'imagem',
  'What animal is this?',
  'Olhe a imagem e diga que animal é este em inglês usando uma frase.',
  'gato-caixa.png',
  array['It is a cat.', 'This is a cat.', 'It''s a cat.'],
  'It is a cat',
  array['vocabulário de animais', 'This is / It is (ordem)'],
  array['You can say: It is a…'],
  null
),
(
  'b0000000-0000-0000-0000-000000000008',
  'a0000000-0000-0000-0000-000000000001',
  'Imagens',
  8,
  'imagem',
  'What color is the cat?',
  'Olhe a imagem e diga a cor do gato em uma frase completa.',
  'gato-caixa.png',
  array['The cat is white.', 'It is white.', 'It''s white.'],
  'The cat is white',
  array['cores', 'It is (ordem)'],
  array['You can say: The cat is…'],
  null
),
(
  'b0000000-0000-0000-0000-000000000009',
  'a0000000-0000-0000-0000-000000000001',
  'Imagens',
  9,
  'imagem',
  'Where is the cat?',
  'Olhe a posição do gato em relação à caixa e diga onde ele está.',
  'gato-caixa.png',
  array['The cat is on the box.', 'It is on a box.', 'It''s on the box.'],
  'The cat is on the box',
  array['preposições', 'It is (ordem)'],
  array['You can say: The cat is on/in…'],
  null
),
(
  'b0000000-0000-0000-0000-000000000010',
  'a0000000-0000-0000-0000-000000000001',
  'Compare as imagens',
  10,
  'comparacao',
  'These two pictures are mostly the same, but there are 4 things that are different. Can you tell me the differences?',
  'Quando você encontrar uma diferença, explique o que muda entre o lado esquerdo e o lado direito (ex.: ''On the left, X is one color, but on the right, it is another color'').',
  'comparacao-dia-noite.png',
  array[
    'On the left, the cat is black, but on the right, it is white.',
    'On the left the cat is on the box, but on the right it is in the box.',
    'On the left it is day, but on the right it is night.'
  ],
  'On the left the cat is black but on the right it is white',
  array['estrutura comparativa On the left… but on the right…', 'cores', 'preposições', 'vocabulário do céu'],
  array['Look at the cat.', 'Look at the sky.', 'Is the cat ON or IN the box?'],
  '{
    "diferencas": [
      { "id": "cor_gato", "esquerda": "black cat", "direita": "white cat", "palavras_chave": ["black","white","cat"] },
      { "id": "posicao", "esquerda": "cat on the box", "direita": "cat in the box", "palavras_chave": ["on","in","inside","box"] },
      { "id": "cor_ceu", "esquerda": "light blue sky (day)", "direita": "dark blue sky (night)", "palavras_chave": ["blue","dark","light","day","night","sky"] },
      { "id": "sol_lua", "esquerda": "sun", "direita": "moon and stars", "palavras_chave": ["sun","moon","stars"] }
    ]
  }'::jsonb
) on conflict (id) do nothing;
