# Deployment Strategie - Staging Environment

## Aktuelle Situation:
- **Main Branch**: thebjelics.com (GitHub Pages) - statische Website
- **Feature Branch**: Lokale Entwicklung - Full-Stack mit Datenbank

## Empfohlener Ansatz:

### 1. Zwei parallele Deployments:
```
Production (Main)          Staging (Feature)
    ↓                          ↓  
thebjelics.com           staging-thebjelics.appspot.com
(GitHub Pages)            (Google Cloud Platform)
(statische Site)          (Full-Stack + DB)
```

### 2. Schritte für Staging Deployment:

#### A) Google Cloud Projekt setup:
```bash
# Neues GCP Projekt erstellen
gcloud projects create wedding-staging-[RANDOM]
gcloud config set project wedding-staging-[RANDOM]

# APIs aktivieren
gcloud services enable sqladmin.googleapis.com
gcloud services enable appengine.googleapis.com
```

#### B) Cloud SQL Datenbank:
```bash
# PostgreSQL Instance erstellen
gcloud sql instances create wedding-staging-db \
    --database-version=POSTGRES_14 \
    --tier=db-f1-micro \
    --region=europe-west3

# Datenbank erstellen
gcloud sql databases create wedding_rsvp --instance=wedding-staging-db

# User erstellen
gcloud sql users create wedding_user \
    --instance=wedding-staging-db \
    --password=SECURE_RANDOM_PASSWORD
```

#### C) App Engine Deployment:
```bash
# App deployen
gcloud app deploy

# URL wird etwa so aussehen:
# https://wedding-staging-[PROJECT-ID].ey.r.appspot.com
```

### 3. Daten Migration:
1. Führe `export_data.sql` in deiner lokalen DB aus
2. Kopiere die generierten INSERT Statements
3. Führe sie in der Cloud SQL Instanz aus

### 4. Testing:
- Teile die Staging-URL mit deinem Freund
- Main Branch bleibt auf thebjelics.com verfügbar
- Nach erfolgreichem Test: Feature Branch → Main mergen

## Kosten:
- Cloud SQL f1-micro: ~$7/Monat
- App Engine: Pay-per-use (sehr günstig)
- **Erste $300 kostenlos** bei neuem GCP Account

## Vorteile:
✅ Beide Versionen parallel verfügbar
✅ Kein Risiko für bestehende Website  
✅ Vollständige Testumgebung
✅ Einfache Daten-Migration
