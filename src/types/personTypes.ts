import { CastMember, Person, PersonReference, ShowCastMember } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface PersonReferenceRow extends RowDataPacket {
  id: number;
  tmdb_id: number;
  name: string;
}

export interface PersonRow extends PersonReferenceRow {
  gender: number;
  biography: string;
  profile_image: string;
  birthdate: string;
  deathdate: string | null;
  place_of_birth: string;
}

export interface MovieCreditRow extends RowDataPacket {
  movie_id: number;
  person_id: number;
  character_name: string;
  title: string;
  poster_image: string;
  release_date: string;
  rating: number;
}

export interface MovieCastMemberRow extends RowDataPacket {
  movie_id: number;
  person_id: number;
  character_name: string;
  cast_order: number;
  name: string;
  profile_image: string;
}

export interface ShowCreditRow extends RowDataPacket {
  show_id: number;
  person_id: number;
  character_name: string;
  title: string;
  poster_image: string;
  release_date: string;
  rating: number;
  total_episodes: number;
}

export interface ShowCastMemberRow extends RowDataPacket {
  show_id: number;
  person_id: number;
  character_name: string;
  cast_order: number;
  total_episodes: number;
  active: number;
  name: string;
  profile_image: string;
}

export interface UpdatePersonResult {
  personId: number;
  success: boolean;
  hadUpdates: boolean;
  error?: string;
}

export function transformPersonReferenceRow(row: PersonReferenceRow): PersonReference {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    name: row.name,
  };
}

export function transformPersonRow(
  row: PersonRow,
  movieCredits: MovieCreditRow[] = [],
  showCredits: ShowCreditRow[] = [],
): Person {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    name: row.name,
    gender: row.gender,
    biography: row.biography,
    profileImage: row.profile_image,
    birthdate: row.birthdate,
    deathdate: row.deathdate,
    placeOfBirth: row.place_of_birth,
    movieCredits: movieCredits.map((credit) => {
      return {
        name: credit.title,
        poster: credit.poster_image,
        year: credit.release_date.split('-')[0],
        character: credit.character_name,
        rating: credit.rating,
      };
    }),
    showCredits: showCredits.map((credit) => {
      return {
        name: credit.title,
        poster: credit.poster_image,
        year: credit.release_date.split('-')[0],
        character: credit.character_name,
        rating: credit.rating,
        episodeCount: credit.total_episodes,
      };
    }),
  };
}

export function transformMovieCastMemberRow(row: MovieCastMemberRow): CastMember {
  return {
    contentId: row.movie_id,
    personId: row.person_id,
    characterName: row.character_name,
    order: row.cast_order,
    name: row.name,
    profileImage: row.profile_image,
  };
}

export function transformShowCastMemberRow(row: ShowCastMemberRow): ShowCastMember {
  return {
    contentId: row.show_id,
    personId: row.person_id,
    characterName: row.character_name,
    order: row.cast_order,
    episodeCount: row.total_episodes,
    active: row.active === 1 ? true : false,
    name: row.name,
    profileImage: row.profile_image,
  };
}
