-- Sincroniza las imagenes/videos oficiales de ejercicios por nombre.
-- Requiere que los archivos existan en backend/uploads/exercises.
BEGIN;

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561457528-288938442.mp4'
WHERE nombre = 'Aperturas con mancuernas';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561452542-958216660.mp4'
WHERE nombre = 'Bicicleta';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561447157-936855839.mp4'
WHERE nombre = 'BoneSmashing';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561436478-920347316.mp4'
WHERE nombre = 'Cinta';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561466158-601595301.mp4'
WHERE nombre = 'Crunch abdominal';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561415770-405910490.mp4'
WHERE nombre = 'Curl femoral';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561411313-338137653.mp4'
WHERE nombre = 'Curl martillo';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561405203-802654968.mp4'
WHERE nombre = 'Dominadas';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561398725-672165831.mp4'
WHERE nombre = 'Elevaciones de piernas';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561391779-513783098.mp4'
WHERE nombre = 'Elevaciones laterales';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561728708-947661330.mp4'
WHERE nombre = 'Elíptico';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561367813-518417809.mp4'
WHERE nombre = 'Extensión de tríceps en polea';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561358533-24106520.mp4'
WHERE nombre = 'FoidMaxxing';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561484763-39640766.mp4'
WHERE nombre = 'Fondos en paralelas';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561499778-180174916.mp4'
WHERE nombre = 'GoonMaxxing';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561510622-492481274.jpeg'
WHERE nombre = 'HeightMaxxing';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561535795-185881093.mp4'
WHERE nombre = 'Jalón al pecho';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561526896-943389491.mp4'
WHERE nombre = 'JesterMaxxing';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561547194-601649554.mp4'
WHERE nombre = 'Pájaros';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561554430-871447255.mp4'
WHERE nombre = 'Peso muerto';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561592293-827907990.mp4'
WHERE nombre = 'Plancha';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561867616-844697801.mp4'
WHERE nombre = 'Prensa de piernas';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561613943-341104789.mp4'
WHERE nombre = 'Press banca';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561625987-620269192.mp4'
WHERE nombre = 'Press francés';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561635030-865605006.mp4'
WHERE nombre = 'Press inclinado';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561644219-604646665.mp4'
WHERE nombre = 'Press militar';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561653825-101014062.mp4'
WHERE nombre = 'Remo con barra';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561660922-43442432.mp4'
WHERE nombre = 'Remo con mancuerna';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781561670801-564346136.mp4'
WHERE nombre = 'RopeMaxxing';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781560635919-416826805.mp4'
WHERE nombre = 'Sentadilla';

UPDATE ejercicio
SET imagen_url = '/uploads/exercises/1781560964550-292439444.mp4'
WHERE nombre = 'Zancadas';

COMMIT;
