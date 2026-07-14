export const DOC_TYPES = ['AADHAAR', 'PAN', 'DRIVING_LICENCE', 'VEHICLE_RC', 'SELFIE'];

export const DOC_LABELS = {
  AADHAAR:         'Aadhaar Card',
  PAN:             'PAN Card',
  DRIVING_LICENCE: 'Driving Licence',
  VEHICLE_RC:      'Vehicle RC',
  SELFIE:          'Selfie / Photo',
};

export const HAS_BACK = new Set(['AADHAAR', 'DRIVING_LICENCE']);

export const EXTRACT_FIELDS = {
  AADHAAR:         { name: 'Name', dob: 'Date of Birth', gender: 'Gender', masked: 'Aadhaar (masked)', state: 'State', pin_code: 'PIN Code', district: 'District' },
  PAN:             { name: 'Name', father: "Father's Name", dob: 'Date of Birth', masked: 'PAN (masked)', govt_verified: 'Govt Verified', pan_status: 'PAN Status', name_match: 'Name Match %', aadhaar_linked: 'Aadhaar Linked' },
  DRIVING_LICENCE: { name: 'Name', dob: 'Date of Birth', masked: 'DL (masked)', blood_group: 'Blood Group', issuing_authority: 'Issuing Authority', issue_date: 'Issue Date', expiry_date: 'Expiry Date', govt_verified: 'Govt Verified' },
  VEHICLE_RC:      { owner: 'Owner', vehicle_model: 'Model', vehicle_type: 'Type', manufacturer: 'Manufacturer', insurance_status: 'Insurance', insurance_expiry: 'Insurance Expiry', fitness_expiry: 'Fitness Expiry', pucc_expiry: 'PUC Expiry', vahan_verified: 'Vahan Verified' },
  SELFIE:          { similarity_score: 'Similarity Score', aadhaar_doc_id: 'Matched Aadhaar Doc' },
};

export const OVERALL_TONE = {
  verified:       'success',
  in_progress:    'warning',
  pending_review: 'info',
  not_started:    'neutral',
  rejected:       'danger',
  suspended:      'warning',
};
