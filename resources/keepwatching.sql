CREATE DATABASE keepwatching;

CREATE TABLE accounts (
    account_id INT AUTO_INCREMENT PRIMARY KEY,
    account_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
	image VARCHAR(255),
	default_profile_id INT,
	uid VARCHAR(255) UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profiles (
    profile_id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
	image VARCHAR(255) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
);

ALTER TABLE accounts ADD FOREIGN KEY(default_profile_id) REFERENCES profiles(profile_id) ON DELETE SET NULL;

CREATE TABLE genres (
	id INT NOT NULL PRIMARY KEY,
	genre VARCHAR(100)
);

CREATE TABLE streaming_services (
	id INT NOT NULL PRIMARY KEY,
	name VARCHAR(100)
);

CREATE TABLE shows (
    id BIGINT AUTO_INCREMENT NOT NULL PRIMARY KEY,
	tmdb_id BIGINT NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    release_date VARCHAR(36),
	poster_image VARCHAR(255),
	backdrop_image VARCHAR(255),
	network VARCHAR(36),
	season_count INT DEFAULT 0,
	episode_count INT DEFAULT 0,
	user_rating FLOAT CHECK (user_rating >= 0 AND user_rating <= 10),
	content_rating VARCHAR(36),
	status VARCHAR(255),
	type VARCHAR(255),
	in_production TINYINT DEFAULT 1,
	last_air_date VARCHAR(36),
	last_episode_to_air BIGINT,
	next_episode_to_air BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE show_genres (
    show_id bigint NOT NULL,
    genre_id INT NOT NULL,
    PRIMARY KEY (show_id, genre_id),
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

CREATE TABLE show_services (
	show_id bigint NOT NULL,
	streaming_service_id INT NOT NULL,
	PRIMARY KEY (show_id, streaming_service_id),
	FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
	FOREIGN KEY (streaming_service_id) REFERENCES streaming_services(id) ON DELETE CASCADE
);

CREATE TABLE seasons (
    id bigint AUTO_INCREMENT NOT NULL PRIMARY KEY,
    show_id bigint NOT NULL,
	tmdb_id bigint NOT NULL UNIQUE,
	name VARCHAR(255),
	overview TEXT,
    season_number INT NOT NULL,
    release_date VARCHAR(36),
	poster_image VARCHAR(255),
	number_of_episodes INT DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
);

CREATE TABLE episodes (
    id bigint AUTO_INCREMENT NOT NULL PRIMARY KEY,
	tmdb_id bigint NOT NULL UNIQUE,
    season_id bigint NOT NULL,
	show_id bigint NOT NULL,
    episode_number INT NOT NULL,
	episode_type VARCHAR(255),
	season_number int,
    title VARCHAR(255),
	overview TEXT,
    air_date VARCHAR(36),
    runtime INT,
	still_image VARCHAR(255),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE TABLE movies (
    id bigint AUTO_INCREMENT NOT NULL PRIMARY KEY,
	tmdb_id bigint NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    release_date VARCHAR(36),
    runtime INT,
	poster_image VARCHAR(255),
	backdrop_image VARCHAR(255),
	user_rating FLOAT CHECK (user_rating >= 0 AND user_rating <= 10),
	mpa_rating VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE movie_services (
	movie_id bigint NOT NULL,
	streaming_service_id INT NOT NULL,
	PRIMARY KEY (movie_id, streaming_service_id),
	FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
	FOREIGN KEY (streaming_service_id) REFERENCES streaming_services(id) ON DELETE CASCADE
);

CREATE TABLE movie_genres (
    movie_id bigint NOT NULL,
    genre_id INT NOT NULL,
    PRIMARY KEY (movie_id, genre_id),
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

CREATE TABLE show_watch_status (
    id BIGINT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    profile_id INT NOT NULL,
    show_id BIGINT NOT NULL,
	status ENUM('NOT_WATCHED', 'WATCHING', 'WATCHED', 'UP_TO_DATE') NOT NULL DEFAULT 'NOT_WATCHED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(profile_id) ON DELETE CASCADE,
	FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
	UNIQUE (profile_id, show_id)
);

CREATE TABLE season_watch_status (
    id BIGINT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    profile_id INT NOT NULL,
    season_id BIGINT NOT NULL,
	status ENUM('NOT_WATCHED', 'WATCHING', 'WATCHED', 'UP_TO_DATE') NOT NULL DEFAULT 'NOT_WATCHED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(profile_id) ON DELETE CASCADE,
	FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
	UNIQUE (profile_id, season_id)
);

CREATE TABLE episode_watch_status (
    id BIGINT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    profile_id INT NOT NULL,
    episode_id BIGINT NOT NULL,
	status ENUM('NOT_WATCHED', 'WATCHING', 'WATCHED') NOT NULL DEFAULT 'NOT_WATCHED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(profile_id) ON DELETE CASCADE,
	FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
	UNIQUE (profile_id, episode_id)
);

CREATE TABLE movie_watch_status (
    id BIGINT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    profile_id INT NOT NULL,
    movie_id BIGINT NOT NULL,
	status ENUM('NOT_WATCHED', 'WATCHING', 'WATCHED') NOT NULL DEFAULT 'NOT_WATCHED',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(profile_id) ON DELETE CASCADE,
	FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

CREATE TABLE notifications (
    notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message TEXT NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL
);

CREATE TABLE account_notifications (
	notification_id BIGINT,
	account_id INT,
	dismissed TINYINT(1),
	PRIMARY KEY (notification_id, account_id),
	FOREIGN KEY (notification_id) REFERENCES notifications(notification_id) ON DELETE CASCADE,
	FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
);

-- Views

CREATE VIEW profile_movies AS
SELECT 
    p.profile_id,
    m.id AS movie_id,
	m.tmdb_id,
    m.title,
    m.description,
    m.release_date,
    m.runtime,
    m.poster_image,
	m.backdrop_image,
    m.user_rating,
    m.mpa_rating,
    GROUP_CONCAT(DISTINCT g.genre SEPARATOR ', ') AS genres,
	GROUP_CONCAT(DISTINCT ss.name SEPARATOR ', ') AS streaming_services,
	ws.status AS watch_status
FROM 
    profiles p
JOIN 
    movie_watch_status ws ON p.profile_id = ws.profile_id
JOIN 
    movies m ON ws.movie_id = m.id
LEFT JOIN 
    movie_genres mg ON m.id = mg.movie_id
LEFT JOIN 
    genres g ON mg.genre_id = g.id
LEFT JOIN
	movie_services ms ON m.id = ms.movie_id
LEFT JOIN
	streaming_services ss on ms.streaming_service_id = ss.id
GROUP BY 
    p.profile_id, m.id, ws.status;
	
	
CREATE VIEW profile_shows AS
SELECT 
    p.profile_id,
    s.id AS show_id,
	s.tmdb_id,
    s.title,
    s.description,
    s.release_date,
    s.poster_image,
	s.backdrop_image,
	s.season_count,
	s.episode_count,
    s.user_rating,
    s.content_rating,
	s.status,
	s.type,
    GROUP_CONCAT(DISTINCT g.genre SEPARATOR ', ') AS genres,
	GROUP_CONCAT(DISTINCT ss.name SEPARATOR ', ') AS streaming_services,
	s.network,
	ws.status AS watch_status,
	le.title as last_episode_title,
	le.air_date as last_episode_air_date,
	le.episode_number as last_episode_number,
	le.season_number as last_episode_season,
	ne.title as next_episode_title,
	ne.air_date as next_episode_air_date,
	ne.episode_number as next_episode_number,
	ne.season_number as next_episode_season
FROM 
    profiles p
JOIN 
    show_watch_status ws ON p.profile_id = ws.profile_id
JOIN 
    shows s ON ws.show_id = s.id
LEFT JOIN 
    show_genres sg ON s.id = sg.show_id
LEFT JOIN 
    genres g ON sg.genre_id = g.id
LEFT JOIN
	show_services ts ON s.id = ts.show_id
LEFT JOIN
	streaming_services ss on ts.streaming_service_id = ss.id
LEFT JOIN
	episodes le on s.last_episode_to_air = le.tmdb_id
LEFT JOIN
	episodes ne on s.next_episode_to_air = ne.tmdb_id
GROUP BY 
    p.profile_id, s.id, ws.status, le.title, le.air_date, le.episode_number, le.season_number, ne.title, ne.air_date, ne.episode_number, ne.season_number;
	
CREATE VIEW profile_seasons AS
SELECT
	p.profile_id,
	s.id as season_id,
	s.show_id,
	s.tmdb_id,
	s.name,
	s.overview,
	s.season_number,
	s.release_date,
	s.poster_image,
	s.number_of_episodes,
	ws.status as watch_status
FROM
	profiles p
JOIN 
	season_watch_status ws ON p.profile_id = ws.profile_id
JOIN
	seasons s ON ws.season_id = s.id
GROUP BY
	p.profile_id, s.id, ws.status;
	
CREATE VIEW profile_episodes AS
SELECT
	p.profile_id,
	e.id as episode_id,
	e.tmdb_id,	
	e.season_id,
	e.show_id,
	e.episode_number,
	e.episode_type,
	e.season_number,
	e.title,
	e.overview,
	e.runtime,
	e.air_date,
	e.still_image,
	ws.status as watch_status
FROM
	profiles p
JOIN 
	episode_watch_status ws ON p.profile_id = ws.profile_id
JOIN
	episodes e ON ws.episode_id = e.id
GROUP BY
	p.profile_id, e.id, ws.status;
	
CREATE VIEW profile_upcoming_episodes AS
SELECT 
    p.profile_id,
	s.id as show_id,
    s.title AS show_name,
    GROUP_CONCAT(ss.name ORDER BY ss.name SEPARATOR ', ') AS streaming_services,
	s.network,
    e.title AS episode_title,
    e.air_date,
    e.episode_number,
    e.season_number,
    e.still_image AS episode_still_image
FROM 
    profiles p
JOIN 
    show_watch_status ws ON p.profile_id = ws.profile_id
JOIN 
    shows s ON ws.show_id = s.id
JOIN 
    episodes e ON s.id = e.show_id
JOIN 
    show_services tss ON s.id = tss.show_id
JOIN 
    streaming_services ss ON tss.streaming_service_id = ss.id
WHERE 
    e.air_date BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY 
    p.profile_id, s.id, e.id
ORDER BY 
    e.air_date, s.title, e.season_number, e.episode_number;

CREATE VIEW profile_recent_episodes AS
SELECT 
    p.profile_id,
	s.id as show_id,
    s.title AS show_name,
    GROUP_CONCAT(ss.name ORDER BY ss.name SEPARATOR ', ') AS streaming_services,
	s.network,
    e.title AS episode_title,
    e.air_date,
    e.episode_number,
    e.season_number,
    e.still_image AS episode_still_image
FROM 
    profiles p
JOIN 
    show_watch_status ws ON p.profile_id = ws.profile_id
JOIN 
    shows s ON ws.show_id = s.id
JOIN 
    episodes e ON s.id = e.show_id
JOIN 
    show_services tss ON s.id = tss.show_id
JOIN 
    streaming_services ss ON tss.streaming_service_id = ss.id
WHERE 
    e.air_date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
GROUP BY 
    p.profile_id, s.id, e.id
ORDER BY 
    e.air_date, s.title, e.season_number, e.episode_number;
	
CREATE VIEW profile_recent_shows_with_unwatched AS
SELECT DISTINCT
  s.id AS show_id,
  s.title AS show_title,
  s.poster_image,
  p.profile_id,
  MAX(ews.updated_at) AS last_watched_date
FROM shows s
JOIN seasons seas ON s.id = seas.show_id
JOIN episodes e ON seas.id = e.season_id
JOIN episode_watch_status ews ON e.id = ews.episode_id
JOIN profiles p ON ews.profile_id = p.profile_id
WHERE ews.status = 'watched'
AND EXISTS (
  SELECT 1 FROM episodes e2
  JOIN seasons seas2 ON e2.season_id = seas2.id
  LEFT JOIN episode_watch_status ews2 ON e2.id = ews2.episode_id AND ews2.profile_id = p.profile_id
  WHERE seas2.show_id = s.id
  AND (ews2.status IS NULL OR ews2.status != 'watched')
  AND e2.air_date IS NOT NULL
  AND e2.air_date <= CURDATE()
)
GROUP BY s.id, s.title, s.poster_image, p.profile_id;

CREATE VIEW profile_next_unwatched_episodes AS
SELECT
  e.id AS episode_id,
  e.title AS episode_title,
  e.overview,
  e.episode_number,
  e.season_number,
  e.still_image as episode_still_image,
  e.air_date,
  s.id AS show_id,
  s.title AS show_name,
  e.season_id,
  s.poster_image,
  s.network,
  GROUP_CONCAT(ss.name ORDER BY ss.name SEPARATOR ', ') AS streaming_services,
  sws.profile_id,
  ROW_NUMBER() OVER (
    PARTITION BY s.id, sws.profile_id 
    ORDER BY e.season_number ASC, e.episode_number ASC
  ) AS episode_rank
FROM episodes e
JOIN shows s ON e.show_id = s.id
JOIN show_watch_status sws ON s.id = sws.show_id
JOIN show_services tss ON s.id = tss.show_id
JOIN streaming_services ss ON tss.streaming_service_id = ss.id
LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = sws.profile_id
WHERE (ews.status IS NULL OR ews.status != 'watched')
AND e.air_date IS NOT NULL
AND e.air_date <= CURDATE()
GROUP BY e.id, sws.profile_id;

-- Reference Data

INSERT INTO `genres` VALUES (12,'Adventure'),(14,'Fantasy'),(16,'Animation'),(18,'Drama'),(27,'Horror'),(28,'Action'),(35,'Comedy'),(36,'History'),(37,'Western'),(53,'Thriller'),(80,'Crime'),(99,'Documentary'),(878,'Science Fiction'),(9648,'Mystery'),(10402,'Music'),(10749,'Romance'),(10751,'Family'),(10752,'War'),(10759,'Action & Adventure'),(10762,'Kids'),(10763,'News'),(10764,'Reality'),(10765,'Sci-fi & Fantasy'),(10766,'Soap'),(10767,'Talk'),(10768,'War & Politics'),(10770,'TV Movie');
INSERT INTO `streaming_services` VALUES (2,'Apple TV'),(3,'Google Play Movies'),(8,'Netflix'),(9,'Amazon Prime Video'),(10,'Amazon Video'),(15,'Hulu'),(43,'Starz'),(79,'NBC'),(80,'AMC'),(83,'The CW'),(123,'FXNow'),(148,'ABC'),(155,'History'),(156,'A&E'),(157,'Lifetime'),(175,'Netflix Kids'),(192,'YouTube'),(207,'The Roku Channel'),(209,'PBS'),(211,'Freeform'),(300,'Pluto TV'),(322,'USA Network'),(328,'Fox'),(337,'Disney+'),(350,'Apple TV+'),(363,'TNT'),(365,'Bravo'),(366,'Food Network'),(386,'Peacock'),(403,'Discovery'),(406,'HGTV'),(408,'Investigation Discovery'),(506,'TBS'),(507,'tru TV'),(508,'DisneyNOW'),(520,'Discovery+'),(526,'AMC+'),(531,'Paramount+'),(613,'Freevee'),(1718,'ESPN'),(1770,'Paramount+ With Showtime'),(1899,'Max'),(9998,'Theater'),(9999,'Unknown');