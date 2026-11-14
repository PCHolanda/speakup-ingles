-- Migration 007: Atualizar todas as instruções de contexto (instrucao_pt) e dicas para deixar explícito o uso de frase completa

UPDATE perguntas
SET
  instrucao_pt = 'Responda em inglês com uma frase completa dizendo o seu nome (ex.: "My name is...").',
  dicas = array['Responda com frase completa. You can say: My name is…']
WHERE id = 'b0000000-0000-0000-0000-000000000001';

UPDATE perguntas
SET
  instrucao_pt = 'Responda em inglês com uma frase completa dizendo a sua idade (ex.: "I am ... years old").',
  dicas = array['Responda com frase completa. You can say: I am … years old.']
WHERE id = 'b0000000-0000-0000-0000-000000000002';

UPDATE perguntas
SET
  instrucao_pt = 'Responda em inglês com uma frase completa dizendo de onde você é, país ou cidade (ex.: "I am from...").',
  dicas = array['Responda com frase completa. You can say: I''m from…']
WHERE id = 'b0000000-0000-0000-0000-000000000003';

UPDATE perguntas
SET
  instrucao_pt = 'Responda em inglês com uma frase completa dizendo se você tem irmãos ou irmãs (ex.: "Yes, I have..." ou "No, I don''t").',
  dicas = array['Responda com frase completa. You can say: Yes, I have… or No, I don''t.']
WHERE id = 'b0000000-0000-0000-0000-000000000004';

UPDATE perguntas
SET
  instrucao_pt = 'Responda em inglês com uma frase completa dizendo o horário em que você costuma acordar (ex.: "I wake up at...").',
  dicas = array['Responda com frase completa. You can say: I wake up at…']
WHERE id = 'b0000000-0000-0000-0000-000000000005';

UPDATE perguntas
SET
  instrucao_pt = 'Responda em inglês com uma frase completa contando uma ou mais coisas que você faz pela manhã (ex.: "In the morning, I...").',
  dicas = array['Responda com frase completa. You can say: In the morning, I…', 'Think about breakfast, school, teeth…']
WHERE id = 'b0000000-0000-0000-0000-000000000006';

UPDATE perguntas
SET
  instrucao_pt = 'Olhe a imagem e responda em inglês com uma frase completa dizendo que animal é este (ex.: "It is a...").',
  dicas = array['Responda com frase completa. You can say: It is a…']
WHERE id = 'b0000000-0000-0000-0000-000000000007';

UPDATE perguntas
SET
  instrucao_pt = 'Olhe a imagem e responda em inglês com uma frase completa dizendo a cor do gato (ex.: "The cat is...").',
  dicas = array['Responda com frase completa. You can say: The cat is…']
WHERE id = 'b0000000-0000-0000-0000-000000000008';

UPDATE perguntas
SET
  instrucao_pt = 'Olhe a imagem e responda em inglês com uma frase completa dizendo onde o gato está em relação à caixa (ex.: "The cat is on/in the box").',
  dicas = array['Responda com frase completa. You can say: The cat is on/in…']
WHERE id = 'b0000000-0000-0000-0000-000000000009';

UPDATE perguntas
SET
  instrucao_pt = 'Responda em inglês com frases completas explicando o que muda entre o lado esquerdo e o lado direito (ex.: "On the left, X is..., but on the right, it is...").',
  dicas = array['Responda com frase completa (ex.: On the left, the cat is…, but on the right, it is…). Look at the cat, the box, and the sky.']
WHERE id = 'b0000000-0000-0000-0000-000000000010';
