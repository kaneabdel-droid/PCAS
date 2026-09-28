// Application de bureau PCAS : une fenêtre qui charge la plateforme en ligne (toujours connectée).
// Aucune commande native n'est exposée au site : la page distante n'a accès à rien d'autre qu'une vue web.
// Les téléchargements (PDF, CSV) sont enregistrés dans le dossier Téléchargements de l'utilisateur.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::DownloadEvent;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const ADRESSE: &str = "https://pcas.dembasolution.com";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let adresse = ADRESSE.parse().expect("adresse PCAS invalide");
            WebviewWindowBuilder::new(app, "principale", WebviewUrl::External(adresse))
                .title("PCAS")
                .inner_size(1280.0, 820.0)
                .min_inner_size(380.0, 600.0)
                .on_download(|webview, evenement| {
                    if let DownloadEvent::Requested { destination, .. } = evenement {
                        if let (Ok(dossier), Some(nom)) = (webview.path().download_dir(), destination.file_name().map(|n| n.to_owned())) {
                            *destination = dossier.join(nom);
                        }
                    }
                    true
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("échec du lancement de PCAS");
}
