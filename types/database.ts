export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Gender = 'male' | 'female' | 'other';
export type UnionStatus = 'married' | 'divorced' | 'widowed' | 'other';
export type RelationType = 'biological' | 'adopted' | 'step';

export interface Tree {
  id: string;
  owner_id: string;
  title_bn: string;
  description_bn: string | null;
  root_person_id: string | null;
  is_public: boolean;
  share_slug: string | null;
  editor_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  tree_id: string;
  full_name_bn: string;
  nickname_bn: string | null;
  gender: Gender;
  birth_date_ad: string | null;
  birth_date_bs: string | null;
  death_date_ad: string | null;
  is_alive: boolean;
  hometown_bn: string | null;
  occupation_bn: string | null;
  bio_bn: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Union {
  id: string;
  tree_id: string;
  partner_1_id: string;
  partner_2_id: string;
  marriage_date_ad: string | null;
  status: UnionStatus;
  created_at: string;
}

export interface ParentChild {
  id: string;
  tree_id: string;
  union_id: string | null;
  parent_id: string;
  child_id: string;
  relation_type: RelationType;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      trees: {
        Row: Tree;
        Insert: {
          id?: string;
          owner_id: string;
          title_bn: string;
          description_bn?: string | null;
          root_person_id?: string | null;
          is_public?: boolean;
          share_slug?: string | null;
          editor_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Tree, 'id'>>;
        Relationships: [];
      };
      persons: {
        Row: Person;
        Insert: {
          id?: string;
          tree_id: string;
          full_name_bn: string;
          nickname_bn?: string | null;
          gender: Gender;
          birth_date_ad?: string | null;
          birth_date_bs?: string | null;
          death_date_ad?: string | null;
          is_alive?: boolean;
          hometown_bn?: string | null;
          occupation_bn?: string | null;
          bio_bn?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<Person, 'id'>>;
        Relationships: [];
      };
      unions: {
        Row: Union;
        Insert: {
          id?: string;
          tree_id: string;
          partner_1_id: string;
          partner_2_id: string;
          marriage_date_ad?: string | null;
          status?: UnionStatus;
          created_at?: string;
        };
        Update: Partial<Omit<Union, 'id'>>;
        Relationships: [];
      };
      parent_child: {
        Row: ParentChild;
        Insert: {
          id?: string;
          tree_id: string;
          union_id?: string | null;
          parent_id: string;
          child_id: string;
          relation_type?: RelationType;
          created_at?: string;
        };
        Update: Partial<Omit<ParentChild, 'id'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
