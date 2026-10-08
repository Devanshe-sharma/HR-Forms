/**
 * backend-node/utils/attendanceEmployees.js
 *
 * Roster of employees as enrolled on the attendance machine, keyed by the
 * machine's employee code. The vendor's push only carries employee_code
 * (e.g. "20"), not a name, and the machine code is not the same as
 * Onboarding.empId — so this list supplies the names, and is also the set of
 * employees the daily attendance report is built for (so someone who never
 * punched still shows up as Absent / On Leave / etc.).
 *
 * Source: the machine software's employee export (Biometric Id / Emp-Code /
 * Employee Name). To add or rename someone, edit the list below.
 */

const MACHINE_EMPLOYEES = {
  1: 'ANURAG',
  2: 'Ranjeet Singh',
  3: 'Ritu Sharma',
  4: 'Sweety Kumari',
  5: 'Abhishek Kumar',
  6: 'Sumit Kumar',
  7: 'Karan Singh',
  8: 'Somnath Mukherjee',
  10: 'Palak Rohilla',
  11: 'Pankti',
  12: 'Mona Kumari',
  13: 'Jainendra Kumar',
  16: 'Vipul Pandey',
  17: 'Shivank Srivastav',
  18: 'Shivharsh Dubey',
  19: 'Tanisha Sharma',
  20: 'Devanshe Sharma',
  21: 'Sandeep Kumar Singh',
  22: 'Gaurav Sharma',
  23: 'Akash Yadav',
  24: 'Sanjana Kumari',
  25: 'Laksh Otwal',
  26: 'Radhika',
  27: 'Adity Kumar',
  28: 'Anshika Yadav',
  29: 'Jagriti Verma',
  30: 'Arnab Bandyopadhyay',
  31: 'Ayush Gupta',
  32: 'Archana Prem',
  35: 'Ailiya Fatima Naqvi',
  37: 'Amit Mathur',
  38: 'Pintu Yadav',
  39: 'Sunil Prem',
  40: 'Divyansh Kholi',
  41: 'Ritika Srivastava',
  42: 'Vijay Singh Bisht',
  43: 'Shruti Garg',
  44: 'Akash Chaudhary',
  45: 'Anuj Sahu',
  46: 'Md Juned Alam',
  47: 'Annarul',
  48: 'Karan Chaudhary',
  49: 'Raju Pandey',
  50: 'Adesh Gupta',
  51: 'Kunal Patel',
  52: 'Kaushalendra Pratap Singh',
  53: 'Shlok Singh',
  54: 'Rasool Ahemad',
  55: 'Suyash Awasthi',
  56: 'Ashmeet Singh',
  58: 'Arnima1',
  59: 'Arnima2',
  60: 'Noopur Aron',
  64: 'Arjun Singh',
  66: 'Arnima Ravishankar',
  67: 'ArnimaiHarish',
  69: 'Harmanpreet Singh',
  70: 'Alok Kumar Singh',
  71: 'Vikasmaurya',
  72: 'monuchahudry',
  73: 'MAYANKSRIVASTAVA',
  75: 'Karannegi',
  78: 'Palaksharma',
  79: 'Sanjana',
  81: 'Shispal',
  82: 'Nikhil',
  83: 'Rohan',
  84: 'Parv Mishra',
  85: 'Abhisheksakya',
  86: 'Vishal',
  87: 'Sumitmishra',
  88: 'Dinesh',
  89: 'Saurabhsukla',
  90: 'Nareshchanderseni',
  91: 'AbhishekFactory',
  92: 'Sandipbabu',
  93: 'Anujadmin',
  94: 'Ramansingh',
  96: 'Vipinkumar',
  97: 'Mayank Singh',
};

// "0000020", "00000020" and "20" are all the same machine code.
const normaliseCode = code => String(code ?? '').trim().replace(/^0+(?=\d)/, '');

const nameForCode = code => MACHINE_EMPLOYEES[normaliseCode(code)] || '';

module.exports = { nameForCode, normaliseCode, MACHINE_EMPLOYEES };
