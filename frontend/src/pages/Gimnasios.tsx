import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { Gimnasio } from "../types";

const API = "http://localhost:3000";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type Position = {
  lat: number;
  lng: number;
};

type MapCenterTrackerProps = {
  onCenterChange: (position: Position) => void;
};

function MapCenterTracker({ onCenterChange }: MapCenterTrackerProps) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    },
  });

  return null;
}

function MapRecenter({ position }: { position: Position }) {
  const map = useMap();

  useEffect(() => {
    map.setView([position.lat, position.lng], map.getZoom());
  }, [map, position.lat, position.lng]);

  return null;
}

const parseError = async (res: Response, fallback: string) => {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
};

type GimnasiosProps = {
  onBack?: () => void;
};

function Gimnasios({ onBack }: GimnasiosProps) {
  const [userPosition, setUserPosition] = useState<Position | null>(null);
  const [searchCenter, setSearchCenter] = useState<Position | null>(null);
  const [mapCenter, setMapCenter] = useState<Position | null>(null);
  const [gimnasios, setGimnasios] = useState<Gimnasio[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingGyms, setLoadingGyms] = useState(false);
  const [error, setError] = useState("");

  const loading = loadingLocation || loadingGyms;

  const sortedGimnasios = useMemo(
    () => gimnasios.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [gimnasios],
  );

  const buscarGimnasios = async (position: Position) => {
    try {
      setLoadingGyms(true);
      setError("");

      const params = new URLSearchParams({
        lat: String(position.lat),
        lng: String(position.lng),
      });
      const res = await fetch(`${API}/gimnasios/cercanos?${params.toString()}`);

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudieron cargar gimnasios cercanos"));
      }

      const data = (await res.json()) as Gimnasio[];
      setGimnasios(Array.isArray(data) ? data : []);
      setSearchCenter(position);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar gimnasios cercanos");
      setGimnasios([]);
    } finally {
      setLoadingGyms(false);
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Tu navegador no permite usar geolocalizacion.");
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserPosition(nextPosition);
        setMapCenter(nextPosition);
        setLoadingLocation(false);
        void buscarGimnasios(nextPosition);
      },
      () => {
        setError("No pudimos acceder a tu ubicacion. Activa permisos para buscar gimnasios cercanos.");
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }, []);

  const handleBuscarEnZona = () => {
    if (!mapCenter) {
      return;
    }

    void buscarGimnasios(mapCenter);
  };

  return (
    <main className="page-shell gyms-page">
      <section className="page-hero compact discover-branch-hero">
        {onBack ? (
          <button type="button" className="btn secondary" onClick={onBack}>
            Volver
          </button>
        ) : null}
        <div className="gyms-title-row">
          <div>
            <h1>Gimnasios cercanos</h1>
            <p className="subtitle">Encuentra gimnasios cerca de tu ubicacion actual.</p>
          </div>
          <div className="gyms-actions">
            <button
              type="button"
              className="btn"
              onClick={handleBuscarEnZona}
              disabled={!mapCenter || loading}
            >
              {loadingGyms ? "Buscando..." : "Buscar en esta zona"}
            </button>
          </div>
        </div>
      </section>

      {loadingLocation ? <div className="status">Buscando gimnasios cercanos...</div> : null}
      {error ? <div className="status error">{error}</div> : null}

      {userPosition ? (
        <section className="gyms-layout">
          <div className="gyms-map-shell">
            <MapContainer
              center={[userPosition.lat, userPosition.lng]}
              zoom={14}
              className="gyms-map"
              scrollWheelZoom
            >
              <MapRecenter position={searchCenter ?? userPosition} />
              <MapCenterTracker onCenterChange={setMapCenter} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CircleMarker
                center={[userPosition.lat, userPosition.lng]}
                radius={9}
                pathOptions={{ color: "#7ed6a1", fillColor: "#7ed6a1", fillOpacity: 0.9 }}
              >
                <Popup>Tu ubicacion</Popup>
              </CircleMarker>
              {gimnasios.map((gym) => (
                <Marker key={gym.id} position={[gym.latitud, gym.longitud]}>
                  <Popup>
                    <div className="gym-popup">
                      <strong>{gym.nombre}</strong>
                      {gym.direccion ? <span>{gym.direccion}</span> : null}
                      <small>GymMaxxing</small>
                      <button type="button" className="btn compact">
                        Ver gimnasio
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <aside className="box gyms-list">
            <div className="gyms-list-head">
              <h2>Resultados</h2>
              <span>{loadingGyms ? "Buscando..." : `${gimnasios.length} gimnasio(s)`}</span>
            </div>
            {sortedGimnasios.length === 0 && !loadingGyms ? (
              <p className="helper-text">No hay gimnasios para mostrar en esta zona.</p>
            ) : null}
            {sortedGimnasios.map((gym) => (
              <article key={gym.id} className="gym-list-item">
                <div>
                  <strong>{gym.nombre}</strong>
                  <span>{gym.direccion || "Sin direccion disponible"}</span>
                </div>
                <small>Local</small>
              </article>
            ))}
          </aside>
        </section>
      ) : null}
    </main>
  );
}

export default Gimnasios;
