-- Música en entrenamientos y rutinas.
-- Playlist de Spotify: el usuario pega el link y el backend completa título y portada con el oEmbed de Spotify.
-- Canción: se elige de las tendencias o de la búsqueda de Apple (iTunes Search API).
-- Las dos son opcionales e independientes.

ALTER TABLE sesionentrenamiento
  ADD COLUMN IF NOT EXISTS playlist_url TEXT,
  ADD COLUMN IF NOT EXISTS playlist_titulo TEXT,
  ADD COLUMN IF NOT EXISTS playlist_portada_url TEXT,
  ADD COLUMN IF NOT EXISTS cancion_apple_id TEXT,
  ADD COLUMN IF NOT EXISTS cancion_titulo TEXT,
  ADD COLUMN IF NOT EXISTS cancion_artista TEXT,
  ADD COLUMN IF NOT EXISTS cancion_portada_url TEXT,
  ADD COLUMN IF NOT EXISTS cancion_url TEXT;

-- La playlist de la rutina se copia al entrenamiento cuando se arranca desde esa rutina.
ALTER TABLE rutina
  ADD COLUMN IF NOT EXISTS playlist_url TEXT,
  ADD COLUMN IF NOT EXISTS playlist_titulo TEXT,
  ADD COLUMN IF NOT EXISTS playlist_portada_url TEXT;
