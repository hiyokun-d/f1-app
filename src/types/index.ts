// OpenF1 API — all endpoint types

export interface Meeting {
  circuit_key: number
  circuit_short_name: string
  country_code: string
  country_key: number
  country_name: string
  date_start: string
  gmt_offset: string
  location: string
  meeting_key: number
  meeting_name: string
  meeting_official_name: string
  year: number
}

export interface Session {
  circuit_key: number
  circuit_short_name: string
  country_code: string
  country_key: number
  country_name: string
  date_end: string
  date_start: string
  gmt_offset: string
  location: string
  meeting_key: number
  session_key: number
  session_name: string
  session_type: string
  total_laps: number | null
  year: number
}

export interface Driver {
  broadcast_name: string
  country_code: string
  driver_number: number
  first_name: string
  full_name: string
  headshot_url: string
  last_name: string
  meeting_key: number
  name_acronym: string
  session_key: number
  team_colour: string
  team_name: string
}

export interface Position {
  date: string
  driver_number: number
  meeting_key: number
  position: number
  session_key: number
}

export interface Interval {
  date: string
  driver_number: number
  gap_to_leader: number | null
  interval: number | null
  meeting_key: number
  session_key: number
}

export interface Lap {
  date_start: string
  driver_number: number
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  i1_speed: number | null
  i2_speed: number | null
  is_pit_out_lap: boolean
  lap_duration: number | null
  lap_number: number
  meeting_key: number
  segments_sector_1: number[] | null
  segments_sector_2: number[] | null
  segments_sector_3: number[] | null
  session_key: number
  st_speed: number | null
}

export interface Stint {
  compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET' | 'UNKNOWN'
  driver_number: number
  lap_end: number
  lap_start: number
  meeting_key: number
  session_key: number
  stint_number: number
  tyre_age_at_start: number
}

export interface Pit {
  date: string
  driver_number: number
  lap_number: number
  meeting_key: number
  pit_duration: number | null
  session_key: number
}

export interface CarData {
  brake: number
  date: string
  driver_number: number
  drs: number
  meeting_key: number
  n_gear: number
  rpm: number
  session_key: number
  speed: number
  throttle: number
}

export interface Location {
  date: string
  driver_number: number
  meeting_key: number
  session_key: number
  x: number
  y: number
  z: number
}

export interface RaceControl {
  category: string
  date: string
  driver_number: number | null
  flag: string | null
  lap_number: number | null
  meeting_key: number
  message: string
  scope: string | null
  sector: number | null
  session_key: number
}

export interface TeamRadio {
  date: string
  driver_number: number
  meeting_key: number
  recording_url: string
  session_key: number
}

export interface Weather {
  air_temperature: number
  date: string
  humidity: number
  meeting_key: number
  pressure: number
  rainfall: number
  session_key: number
  track_temperature: number
  wind_direction: number
  wind_speed: number
}

// Locally computed — detected from consecutive position array comparisons
export interface OvertakeEvent {
  overtakingDriver: number
  overtakenDriver: number
  newPosition: number
  lapNumber: number
  timestamp: string
}

// Locally detected overtake (from /overtakes endpoint)
export interface Overtake {
  date: string
  driver_number_fastest: number
  driver_number_slower: number
  meeting_key: number
  session_key: number
}

// OpenF1 /session_result endpoint
export interface SessionResult {
  date: string
  driver_number: number
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  gap_to_leader: number | null
  meeting_key: number
  number_of_laps: number | null
  position: number
  session_key: number
}

// OpenF1 /starting_grid endpoint
export interface StartingGrid {
  driver_number: number
  meeting_key: number
  position: number
  session_key: number
  team_name: string | null
}

// OpenF1 /championship_drivers endpoint (beta)
export interface ChampionshipDriver {
  driver_number: number
  meeting_key: number
  points: number
  position: number
  session_key: number
}

// OpenF1 /championship_teams endpoint (beta)
export interface ChampionshipTeam {
  meeting_key: number
  points: number
  position: number
  session_key: number
  team_name: string
}
