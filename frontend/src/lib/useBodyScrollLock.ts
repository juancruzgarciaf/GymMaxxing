import { useEffect } from "react";

// Bloquea el scroll de la página mientras hay un modal abierto.
// Lleva la cuenta de los modales abiertos, así un modal encima de otro
// (por ejemplo, el selector de canción dentro de "Modificar entrenamiento")
// no desbloquea el fondo al cerrarse.
let openLocks = 0;
let previousBodyOverflow = "";
let previousRootOverflow = "";

export const useBodyScrollLock = (active: boolean) => {
  useEffect(() => {
    if (!active) {
      return;
    }

    if (openLocks === 0) {
      previousBodyOverflow = document.body.style.overflow;
      previousRootOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    openLocks += 1;

    return () => {
      openLocks -= 1;
      if (openLocks === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousRootOverflow;
      }
    };
  }, [active]);
};
