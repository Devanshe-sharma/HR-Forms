import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatSalary, formatDate } from '../utils/helpers'; // or '../utils/format' - use your correct path

const API_BASE = 'https://hr-forms.onrender.com/api';

export default function LetterTemplate() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'salary-revision';
  const empId = searchParams.get('empId');
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (empId) {
      fetch(`${API_BASE}/employees/${empId}/`)
        .then(res => res.json())
        .then(data => {
          setEmployee(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [empId]);

  if (loading) return <div className="p-10 text-center text-gray-600">Loading letter...</div>;
  if (!employee) return <div className="p-10 text-center text-red-600">Employee not found</div>;

  const today = formatDate(new Date().toISOString());

  // Split full_name into First, Middle, Last (basic split - improve if needed)
  const nameParts = employee.full_name.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  const renderSalaryRevisionLetter = () => (
    <div className="max-w-4xl mx-auto p-16 mt-16 bg-white font-serif leading-snug text-sm print:p-16 print:text-xs print:max-w-none">
    {/* Strictly Confidential Heading */}
    <div className="text-center mb-3">
      <h2 className="text-lg font-bold uppercase tracking-wide pb-1">
        Strictly Personal & Confidential
      </h2>
    </div>

    {/* Date & Employee ID */}
    <div className="mb-4 text-left">
      <p>
        <strong>Date:</strong> {today} <br />
        <strong>Employee ID:</strong> {employee.employee_id || 'N/A'}
      </p>
    </div>

    {/* Address */}
    <div className="mb-4">
      <p>
        <strong>Name:</strong> {employee.full_name}<br />
        <strong>Address:</strong> [Address_Custom] {/* Replace with actual field */}
      </p>
    </div>

    {/* Subject */}
    <p className="mb-4 font-bold">Sub: Salary Revision</p>

    {/* Salutation */}
    <p className="mb-4">Dear {employee.full_name.split(' ')[0]},</p>

    {/* Body */}
    <ol className="list-decimal pl-5 space-y-4">
      <li>
        We are pleased to inform you that your salary has been revised upwards.
      </li>

      <li className="space-y-2">
        The revised salary details are as follows:
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse border border-black text-xs">
            <tbody>
              <tr>
                <td className="border border-black px-3 py-1 font-bold">Date applicable:</td>
                <td className="border border-black px-3 py-1">
                  {formatDate(employee.sal_applicable_from || today)}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-1 font-bold">Company:</td>
                <td className="border border-black px-3 py-1">
                  Brisk Olive Business Solutions Pvt Ltd
                </td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-1 font-bold">Department:</td>
                <td className="border border-black px-3 py-1">
                  {employee.department || '[Department_Custom]'}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-1 font-bold">Designation:</td>
                <td className="border border-black px-3 py-1">
                  {employee.designation || '[Designation_Custom]'}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-1 font-bold">Reporting To:</td>
                <td className="border border-black px-3 py-1">
                  [Reporting Manager_Custom]
                </td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-1 font-bold">Annual CTC:</td>
                <td className="border border-black px-3 py-1 font-bold">
                  {formatSalary(employee.annual_ctc || 0)}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-1 font-bold">Details of CTC:</td>
                <td className="border border-black px-3 py-1">
                  Attached as Annexure 'A'
                </td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-1 font-bold">Benefits:</td>
                <td className="border border-black px-3 py-1">
                  As per Company Policy
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </li>

      <li>
        Other Terms and Conditions: All other Terms and Conditions of your employment remain unchanged, as per your initial appointment letter, or subsequent instructions, if any.
      </li>

      <li>
        We congratulate you and wish you success in your endeavours.
      </li>
    </ol>

    {/* Closing */}
    <div className="mt-8 text-left">
      <p>For Brisk Olive Business Solutions Pvt Ltd</p>
      <p className="mt-6">Authorised Signatory</p>
    </div>

    {/* Acceptance Section */}
    <div className="mt-8 pt-6">
      <p className="font-bold">Authorised Signatory</p>
      <p className="mt-3">
        I accept the Company's terms and conditions and confirm my taking up the above position.
      </p>
      <div className="mt-6 space-y-1.5">
        <p><strong>Signatures [Employee]:</strong></p>
        <p><strong>Name:</strong> {employee.full_name}</p>
        <p><strong>Date:</strong></p>
        </div>

    </div>
  </div>
);

  const renderConfirmationLetter = () => (
    <div className="max-w-4xl mx-auto p-16 mt-16 bg-white font-serif leading-snug text-sm print:p-16 print:text-xs print:max-w-none">
      {/* Strictly Confidential Heading */}
      <div className="text-center mb-3">
        <h2 className="text-lg font-bold uppercase tracking-wide pb-1">
          Strictly Personal & Confidential
        </h2>
      </div>

      {/* Date */}
      <div className="mb-4 text-left">
        <p>
          <strong>Date:</strong> {today}
        </p>
      </div>

      {/* Employee ID */}
      <div className="mb-4">
        <p>
          <strong>Employee ID:</strong> {employee.employee_id || 'N/A'}
        </p>
      </div>

      {/* Name Breakdown */}
      <div className="mb-3">
        <p>
          <strong>First Name:</strong> {firstName} <br />
          <strong>Middle Name:</strong> {middleName || '[Middle_Name_Custom]'} <br />
          <strong>Surname:</strong> {lastName || '[Last_Name_Custom]'}
        </p>
      </div>

      {/* Subject */}
      <p className="mb-4 font-bold">Sub: Confirmation Letter</p>

      {/* Salutation */}
      <p className="mb-4">Dear {employee.full_name.split(' ')[0]},</p>

      {/* Body */}
      <p className="mb-4">
        Following completion of your confirmation period, we are pleased to inform you that your employment with the Company has been confirmed with effect from {formatDate(employee.joining_date || today)}.
      </p>

      <p className="mb-4">
        All other Terms and Conditions of your employment remain unchanged as per your initial appointment letter, or subsequent instructions, if any.
      </p>

      <p className="mb-3">
        We congratulate you and wish you success in your endeavours.
      </p>

      {/* Closing */}
      <div className="mt-8 text-left">
        <p>For Brisk Olive Business Solutions Pvt Ltd</p>
        <p className="mt-6">Authorised Signatory</p>
      </div>

      {/* Acceptance Section */}
      <div className="mt-8 pt-6">
        <p className="font-bold">Authorised Signatory</p>
        <p className="mt-3">
          I accept the Company's terms and conditions and confirm my taking up the above position.
        </p>

        <p className="mt-6 leading-relaxed">
        <strong>Signatures of Employee:</strong>
        <br className="mb-4" />
        <strong>First Name:</strong> {firstName}
        <br className="mb-4" />
        <strong>Middle Name:</strong> {middleName || '[Middle_Name_Custom]'}
        <br className="mb-4" />
        <strong>Surname:</strong> {lastName || '[Last_Name_Custom]'}
        <br className="mb-4" />
        <strong>Date:</strong>
        </p>

      </div>
    </div>
  );
  
  const renderConsultantContractLetter = () => (
  <div className="max-w-4xl mx-auto p-10 mt-10 bg-white font-serif leading-snug text-sm print:p-16 print:text-xs print:max-w-none">
    {/* Page 1 Content */}
    <div className="page-break-after">
      {/* Strictly Confidential Heading */}
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold uppercase tracking-wide pb-1">
          Strictly Personal & Confidential
        </h2>
      </div>

      {/* Subject */}
      <p className="mb-3 font-bold text-left">
        Subject: CONSULTANT CONTRACT
      </p>

      {/* Clause 1 */}
      <p className="mb-3">
        1. This contract is entered into between Brisk Olive Business Solutions Pvt Ltd hereinafter referred to as the "Company", represented by its duly authorized representative, and
      </p>

      {/* Name & Date Table */}
      <div className="mb-4 overflow-x-auto">
        <table className="w-full border-collapse border border-black text-xs">
          <tbody>
            <tr>
              <td className="border border-black px-4 py-2 font-bold w-1/3">Name:</td>
              <td className="border border-black px-4 py-2">
                {employee.full_name || '[Name_Custom]'}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-4 py-2 font-bold">On:</td>
              <td className="border border-black px-4 py-2">
                {today}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mb-3">
        2. The Company, based on information provided by the Consultant, appoints the Consultant, as per terms of this contract,
      </p>

      {/* Appointment Table */}
      <div className="mb-4 overflow-x-auto">
        <table className="w-full border-collapse border border-black text-xs">
          <tbody>
            <tr>
              <td className="border border-black px-4 py-2 font-bold w-1/3">As:</td>
              <td className="border border-black px-4 py-2">
                {employee.designation || '[Designation_Custom]'}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-4 py-2 font-bold">For the specific period of:</td>
              <td className="border border-black px-4 py-2">
                {employee.contract_period_months || '[Contractual Period]_Custom'} months
              </td>
            </tr>
            <tr>
              <td className="border border-black px-4 py-2 font-bold">Starting On:</td>
              <td className="border border-black px-4 py-2">
                {formatDate(employee.sal_applicable_from || today)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment Clause */}
      <p className="mb-3">
        3. The Consultant shall be paid consolidated amount, per month, inclusive of all expenses made by the Consultant and also includes taxes equal to:
      </p>

      {/* Payment Table */}
      <div className="mb-4 overflow-x-auto">
        <table className="w-full border-collapse border border-black text-xs">
          <tbody>
            <tr>
              <td className="border border-black px-4 py-2 font-bold w-1/3">Amount:</td>
              <td className="border border-black px-4 py-2 font-bold">
                {formatSalary(employee.contract_amount || employee.annual_ctc / 12 || 0)} per month
              </td>
            </tr>
            <tr>
              <td className="border border-black px-4 py-2 font-bold">For:</td>
              <td className="border border-black px-4 py-2">
                {employee.contract_period_months || '[Contractual Period](in months)_Custom'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Reporting Clause */}
      <p className="mb-3">
        4. The Consultant's reporting relationship and location shall be as follows:
      </p>

      {/* Reporting Table */}
      <div className="mb-10 overflow-x-auto">
        <table className="w-full border-collapse border border-black text-xs">
          <tbody>
            <tr>
              <td className="border border-black px-4 py-2 font-bold w-1/3">Department:</td>
              <td className="border border-black px-4 py-2">
                {employee.department || '[Department_Custom]'}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-4 py-2 font-bold">Reporting to:</td>
              <td className="border border-black px-4 py-2">
                [Reporting Manager_Custom]
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Additional Clauses (5–8) */}
      <ol className="list-decimal pl-5 space-y-4" start={5}>
        <li>
          <strong>DETAILS OF ADDRESS:</strong> the Company in writing regarding any change of address within a week from the change of the same. All correspondence shall be addressed in writing to the Consultant at the Consultant's local address mentioned in this contract, or on the changed address, if intimated by the Consultant in writing, and if any letter / notice is received back undelivered or due to avoiding/refusing to take delivery or due to the Consultant's non-availability in spite of repeated visits or if the local address is found to be wrong or incomplete, the letter/notice so received back shall be deemed to have been delivered to the Consultant.
        </li>

        <li>
          The contract is being made on incomplete basis for a fixed period as stated above, shall be deemed to have been delivered to come to an end on the expiry of the specified period and no notice or notice pay or retrenchment compensation will be payable to the Consultant by the Company. The Consultant will not claim regular employment even if there is such a vacancy for the post held by Consultant either side. Except 15 days notice no compensation is payable even if the contract is terminated before the specified period otherwise.
        </li>

        <li>
          In case any of the information suppressed by the Consultant in the Consultant's application is found false or it is subsequently found that he/she has suppressed any vital information at any time during the period of this contract, the Company is liable to be terminated without any notice.
        </li>

        <li>
          <strong>REPORTING:</strong> The Consultant's reporting is to the Board through the Team Lead. Any changes shall be intimated to the Consultant, in writing, by the Company from time to time.
        </li>
      </ol>
    </div>

    {/* Page Break - New content starts on page 2 */}
    <div className="max-w-4xl mx-auto p-10 mt-10 bg-white font-serif leading-snug text-sm print:p-16 print:text-xs print:max-w-none"></div>

    {/* Page 2 - Clause 9 */}
        <ol className="list-decimal pl-5 space-y-4" start={9}>
    <li>
        <strong>FULL-TIME CONTRACT:</strong> The contract is a full-time contract. In case the Consultant takes up any other work, honorary or remuneratory, (part time or otherwise), or work in an advisory capacity, in any other trade or business during the Consultant's contract with the Company, the Consultant shall inform the Management of the Company in writing.
    </li>
    <li>
        <strong>RULES AND REGULATIONS:</strong> The Consultant, during the contract with the Company, shall be governed by the policies and rules of the Company as applicable, from time to time. These rules will cover work tools, if any, misconduct, indiscipline and any other matters pertaining to Company policies and rules. Being unaware of the Company policies and rules shall not be a reason for non-adherence to these rules and policies. The Consultant shall be required to remain aware of the same. Violation of Company rules and policies shall result in termination of this contract.
    </li>
    <li>
        <strong>WORK DAYS, TIMINGS, HOLIDAYS AND LEAVE RULES:</strong> Work days, timings, holidays and leave rules shall be as per the Company’s policy and rules, and subject to change as per the Company’s policy.
    </li>
    <li>
    <strong>CONFIDENTIALITY:</strong>
        <ol style={{ listStyleType: 'lower-alpha', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>The Consultant will not, at any time, during the contract or after, disclose or divulge or make public, any information regarding the Company’s affairs or administration, technical know-how, security arrangements or research carried out, whether the same is confided to the Consultant or becomes known to the Consultant in the course of service or otherwise. Violation of this shall amount to Breach of Contract.</li>
            <li>The Consultant's obligation to keep such information confidential shall survive even on termination or cancellation of the contract.</li>
        </ol>
        </li>
    <li>
        <strong>INTELLECTUAL PROPERTY:</strong> The Consultant conceives any new or advanced method of improving designs/ processes/ formulae/ systems, etc. in relation to the business/ operations of the Company, such developments will be fully communicated to the Company and will be, and remain, the sole right/ property of the Company.
    </li>
    <li>
    <strong>Non disclosure Agreement:</strong> The Consultant shall be required to sign the Non Disclosure Agreement at Annexure A, as part of this Contract.
  </li>
  <li>
    <strong>COMPANY PROPERTY / ASSETS:</strong> The Consultant will be responsible for the safe keeping and return in good condition and order, of all the properties of the Company/Business Unit, which may be in the Consultant's use, custody, care or charge. For the loss of any property of the Company / Business Unit, in the Consultant's possession, the Company / Business Unit shall have right to assess on its own basis and recover the damages of all such material from the Consultant and to take such other action as it deems proper, in the event of the Consultant's failure to account for such material or property to its satisfaction.
  </li>
  <li>
    <strong>RESTRICTIVE COVENANTS:</strong>
    <ol style={{ listStyleType: 'lower-alpha', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
      <li>The Consultant shall not, at any time after termination / expiration of the contract with the Company, without the consent of the Company in writing, represent still to be connected with the Company or any of the Group Companies.</li>
      <li>The Consultant shall not, during the period of twelve months after termination / expiration of the contract with the Company, solicit or endeavor to entice away from, or discourage from being employed by, the Company or any Group Company, any executive, who to the Consultant's knowledge was an employee of the Company or any of the Group Companies at the date of termination / expiration of the contract with the Company or who to the Consultant's knowledge has at that date agreed to be engaged as an employee of the Company or of any of the Group Companies.</li>
    </ol>
  </li>
  <li>
    <strong>PROFESSIONAL ETHICS:</strong> The Consultant shall deal with the Company’s money, material and documents with utmost honesty and professional ethics. If the Consultant is found guilty, at any point of time, of moral turpitude or of dishonesty in dealing with the Company’s money or material or documents or of theft or of misappropriation, regardless of the value involved, the contract will be terminated with immediate effect, notwithstanding other terms and conditions mentioned in this contract letter.
  </li>
  <li>
    <strong>STATUTORY COMPLIANCES:</strong>
    <ol style={{ listStyleType: 'lower-alpha', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
      <li>The consolidated amount payable to the Consultant will be liable / subject to deduction of Tax, etc., in accordance with statutory provisions and provisions of the Income Tax Act and Rules made there-under, as also other applicable laws, if any, as may be enforced from time to time.</li>
      <li>The Company lays emphasis on all statutory compliances and the Consultant shall be required to ensure compliance with various statutes in the Consultant's area of operations, including Insider Trading Regulations.</li>
    </ol>
  </li>
  <li>
    
    {/* Page Break - New content starts on page 2 */}
    <div className="max-w-4xl mx-auto p-10 mt-10 bg-white font-serif leading-snug text-sm print:p-16 print:text-xs print:max-w-none"></div>
     
    <strong>CONFLICT OF INTEREST:</strong> During the Consultant's contract with the Company, the Consultant shall ensure that in case of serving anywhere else on honorary or remunerative terms, or engaging in business in the Consultant's individual capacity, there is no conflict of interest between the Consultant's contractual obligations with the Company / any of its Group or affiliated Companies and his / her other engagements. In case such a conflict interest appears likely at any time, the Consultant shall inform the Company Management in advance, who shall then be free to terminate this contract with the Consultant.
  </li>
  <li>
    <strong>CODE OF ETHICS:</strong> The Consultant is required to maintain the highest order of discipline and ethics as regards the work of the Company and / or its subsidiaries or associate companies and in case of any breach of discipline / trust, the Consultant's services may be terminated by the Company with immediate effect. The Consultant shall also be required to sign the Code of Ethics of the Company (Annexure B).
  </li>
  <li>
    <strong>SERVICE RULES AND REGULATIONS:</strong> The Consultant will be governed by the Company’s Service Rules and Regulations including the conduct, discipline and appeal rules, administrative orders and such other rules / orders of the Company and Business Unit that may be in force from time to time.
  </li>
  <li>
    <strong>HANDING OVER COMPANY PROPERTY / ASSETS:</strong> The Consultant will hand over charge of the property and material of the Company in the Consultant's possession at the time of cessation of this contract, or whenever asked to do so.
  </li>
  <li>
    The Consultant will be liable to pay damages to the Company for the loss caused by the Consultant directly or indirectly, in addition to other legal remedies which may be required, for violating any of the provisions of this letter and for this the Court at Delhi, India shall have the jurisdiction.
  </li>
  <li>
    No cognizance shall be taken of any letter/application received from the Consultant or sent by him / her or sent on his / her behalf, if it does not contain the Consultant's address for sending a reply, if necessary.
  </li>
  <li>
    There is no relation between Consultant and The Company.
  </li>
  <li>
    <strong>Termination of Contract:</strong>
    <ol style={{ listStyleType: 'lower-alpha', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
      <li>In the normal course, the contract would terminate automatically on the date of expiry of the contract, unless renewed in writing through a fresh contract.</li>
      <li>The company may also terminate this contract in case of violation of any of the terms of this contract or violation of Company Policies or Code of Ethics by the Consultant, immediately and without any notice.</li>
    </ol>
  </li>
    </ol>
    <table className="w-full border-collapse mt-8">
  <tbody>
    <strong>
    <tr>
      <td className="border border-black py-6 w-1/2 align-top">
        Witness 1 (Signatures, Name, Address):
      </td>
      <td className="border border-black p-6 w-1/2 align-top">
        Signature of Consultant:
      </td>
    </tr>
    <tr>
      <td className="border border-black py-6 w-1/2 align-top">
        Witness 2 (Signatures, Name, Address):
      </td>
      <td className="border border-black p-6 w-1/2 align-top ">
        Signatures of Authorized representative of the Company:
      </td>
    </tr>
    </strong>
  </tbody>
</table>

  </div>
  );

  const renderSalaryBreakdownLetter = () => (
  <div className="max-w-3xl mx-auto p-10 bg-white font-serif leading-snug text-sm print:p-8 print:text-xs print:max-w-none">
    {/* Header Section */}
    <div className="text-center mb-6">
      <h1 className="text-xl font-bold">
        Annexure A - Salary Breakdown
      </h1>
    </div>

    {/* Salary Breakdown Table */}
    <div className="overflow-x-auto">
      <table className="mx-auto max-w-2xl overflow-x-auto">
        <tbody>
          {/* Metadata Section */}
          <tr>
            <td className="border border-black px-3 py-1 font-bold w-3/5">CompanyID:</td>
            <td className="border border-black px-3 py-1">Brisk Olive Business Solutions Pvt Ltd</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">EmployeeID:</td>
            <td className="border border-black px-3 py-1">{employee.employee_id || '74'}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">First Name:</td>
            <td className="border border-black px-3 py-1">{firstName || '[Custom_First Name]'}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Middle Name:</td>
            <td className="border border-black px-3 py-1">{middleName || ''}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Last Name:</td>
            <td className="border border-black px-3 py-1">{lastName || '[Custom_Last Name]'}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Occurrence Type:</td>
            <td className="border border-black px-3 py-1"></td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Offer Date**:</td>
            <td className="border border-black px-3 py-1">{formatDate(employee.offer_accepted_date || today)}</td>
          </tr>

          {/* Core Salary Section */}
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Basic Salary:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.basic) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">House Rent Allowance:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.hra) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Telephonic Allowance:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.telephone_allowance) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Conveyance Allowance:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.travel_allowance) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Statutory Bonus:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.statutory_bonus) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Education Allowance:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.childrens_education_allowance) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Gross Monthly Salary:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.gross_monthly) || 0)}</td>
          </tr>

          {/* Contributions Section */}
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Employer ESIC Contribution:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.employer_esi) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Employer PF Contribution:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.employer_pf) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Monthly CTC:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.monthly_ctc) || 0)}</td>
          </tr>

          {/* Annual Reimbursements Section */}
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Medical Reimbursement Annual:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.medical_reimbursement_annual) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Vehicle Reimbursement Annual:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.vehicle_reimbursement_annual) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Driver Reimbursement Annual:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.driver_reimbursement_annual) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Tele Reimbursement Annual:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.telephone_reimbursement_annual) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Meals Reimbursement Annual:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.meals_reimbursement_annual) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Uniform Reimbursement Annual:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.uniform_reimbursement_annual) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Leave Travel Allowance Annual:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.leave_travel_allowance_annual) || 0)}</td>
          </tr>

          {/* Final Totals Section */}
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Annual Bonus:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.annual_bonus) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Annual Performance Incentive*:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.annual_performance_incentive) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Gratuity:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.gratuity) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Mediclaim Premium:</td>
            <td className="border border-black px-3 py-1">{formatSalary(Number(employee.medical_premium) || 0)}</td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 font-bold">Annual CTC:</td>
            <td className="border border-black px-3 py-1 font-bold">{formatSalary(Number(employee.annual_ctc) || 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    {/* Footer Text Content */}
    <div className="mt-8 text-[12px] leading-relaxed mx-auto max-w-2xl">
      <p className="mb-1">
        * The Performance Incentive component shall be payable in part / whole, as per the Performance Management Policy of the Company.
      </p>
      <p className="mb-4">
        ** The Offer is subject to the Candidate joining the Company on or before the due date.
      </p>

      <div className="space-y-2">
        <p>
          <span className="font-bold">1. CTC (Cost to Company):</span> CTC Includes all costs borne by the Company on account of the Employee, e.g., Salary, PF, ESIC, Gratuity, Benefits like Insurance Premium, etc.
        </p>
        <div>
          <p className="font-bold">2. PF (Provident Fund) Includes 2 components:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              <span className="font-bold">Employer’s PF:</span> Amount deposited by Employer into Employee’s PF Account / Pension Fund. This is part of CTC, but not of Salary.
            </li>
            <li>
              <span className="font-bold">Employee’s PF:</span> This amount is deducted by the Company from the Employee’s Salary and deposited into the Employee’s PF Account.
            </li>
          </ul>
        </div>
      </div>
    </div>
    {/* PAGE 2 */}
    <div className="bg-white p-8 print:p-6 mt-10 print:mt-0">
      <div className="mx-auto max-w-2xl space-y-4 pt-10">
        <ul className="list-none space-y-2">
          <li className="flex gap-2 ml-4"><span>□</span> <span><span className="font-bold">Example of PF:</span> Employee CTC is Rs. 4.5 Lakhs per annum</span></li>
          <li className="flex gap-2 ml-4 items-start">
            <span className="text-[6px] mt-1.5">■</span> 
            <span><span className="font-bold">Employer's PF contribution - 21600 p.a.</span> This amount is included in CTC. 8.33% is transferred to the Employee's Pension Fund and 3.67% to the Employee's PF Account</span>
          </li>
          <li className="flex gap-2 ml-4 items-start">
            <span className="text-[6px] mt-1.5">■</span> 
            <span><span className="font-bold">Employee's PF contribution - 21600 p.a.</span> This amount is deducted from the Employee's Salary and deposited in the Employee's PF account.</span>
          </li>
        </ul>

        <div className="space-y-2">
          <p>3. <span className="font-bold">Gratuity is payable after completion of minimum 5 years service</span> (or as per latest Gratuity rules).</p>
          <p>4. <span className="font-bold">Tax Deduction at Source will be done as per Government rules.</span></p>
        </div>

        {/* Signature Section */}
        <div className="mt-20 grid grid-cols-2 gap-20">
          <div className="space-y-16">
            <p className="font-bold">Signatures of Authorized Signatory:</p>
            <p className="font-bold">Date:</p>
          </div>
          <div className="space-y-16">
            <p className="font-bold">Signatures of Appointee:</p>
            <p className="font-bold">Date:</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  );

   const renderNonCompeteAgreement = () => (
  <div className="max-w-4xl mx-auto p-16 bg-white print:p-16 print:text-xs print:max-w-none">
    {/* Identification Section - Occupies approx 1/3 of the page */}
    <div className="min-h-[33vh] flex flex-col justify-start">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold inline-block pb-1">
          Consultants / Employees Non-Compete Agreement
        </h2>
        <p className="mt-4 uppercase text-[14px] text-left font-bold tracking-tighter">
          THIS NON-COMPETE AGREEMENT (the "Agreement") is entered into by and between
        </p>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full border border-gray-400 ">
          <tbody>
            <tr>
              <td colSpan={2} className="border border-gray-500 px-3 py-2 font-bold bg-gray-50">
                Brisk Olive Business Solutions Pvt Ltd
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-gray-500 px-3 py-1 font-bold">
                (hereinafter referred to as the "Company")
              </td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-3 py-2 font-bold w-1/3">having an address at:</td>
              <td className="border border-gray-500 px-3 py-2">
                G 203 (First Floor), Sector 63, Noida (U.P.), India, PIN-201307
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-gray-500 px-3 py-1 font-bold">and</td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-3 py-2 font-bold">FirstName:</td>
              <td className="border border-gray-500 px-3 py-2">{firstName || '[Custom_First Name]'}</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-2 font-bold">MiddleName:</td>
              <td className="border border-black px-3 py-2">{middleName || '[Custom_Middle Name]'}</td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-3 py-2 font-bold">Surname:</td>
              <td className="border border-gray-500 px-3 py-2">{lastName || '[Custom_Last Name]'}</td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-3 py-1 font-bold">("the Employee/Consultant")</td>
              <td className="border border-gray-500 px-3 py-2"></td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-3 py-2 font-bold">resident of:</td>
              <td className="border border-gray-500 px-3 py-2"></td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-3 py-2 font-bold text-left">on this:</td>
              <td className="border border-gray-500 p-0">
                <div className="flex h-full">
                  <div className="flex-grow px-3 py-2 border-r border-gray-500">
                    {today}
                  </div>
                  <div className="w-24 px-2 py-1 text-[9px] leading-tight flex items-center justify-center text-center">
                    (the "Effective" Date)
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
    </div>

    <div className="space-y-4">
        <p className="font-bold">The Employee does hereby acknowledge and confirm that:</p>
        <ol className="list-decimal pl-5 space-y-3">
          <li>I am accepting employment with the Company. Now, as per the presents below, I agree to the following terms herein, and acknowledge that this is a material condition of my employment with the Company.</li>
          <li>I am required, on behalf of the Company, to provide services to, or solicit business from, various clients of the Company for whom I shall perform services as a Company employee (each such client hereinafter referred to as a "Customer").</li>
          <li>In consideration of the above, I agree that for a period of 3 years (three years) following the termination of my employment with the Company for any reason, I will not:
            <ol style={{ listStyleType: 'lower-alpha' }} className="pl-6 mt-2 space-y-2">
              <li>accept any offer of employment from any Customer, where I had worked in a professional capacity with that Customer in the 3 years (three years) immediately preceding the termination of my employment with the Company;</li>
              <li>accept any offer of employment from any other Company's Business, if my employment with such a Company would involve me having to work with a Customer with whom I had worked in the 3 years (three years) immediately preceding the termination of my employment with the Company.</li>
            </ol>
          </li>
          <li>If an employee under probation resigns from the job, within 6 months of joining the company, the company may ask the employee to leave immediately. It is the company's discretion to provide or not to provide the 1 month notice period to the employee after resigning.</li>
        </ol>
      </div>
    </div>

    {/* PAGE 2: Execution / Signatures */}
    <div className="bg-white p-12 print:p-10 min-h-[500px]">
      <div className="space-y-8">
        {/* Company Signature Table */}
        <table className="w-full border-collapse border border-black">
          <tbody>
            <tr>
              <td className="border border-black px-3 py-2 font-bold w-1/4">Authorized Signatory</td>
              <td className="border border-black px-3 py-2 w-1/4"></td>
              <td className="border border-black px-3 py-2 font-bold w-1/6 text-center">Company:</td>
              <td className="border border-black px-3 py-2 font-bold">Brisk Olive Business Solutions Pvt Ltd</td>
            </tr>
          </tbody>
        </table>

        {/* Employee Signature Table */}
        <table className="w-full border-collapse border border-black">
          <tbody>
            <tr>
              <td rowSpan={3} className="border border-black px-3 py-2 w-1/4"></td>
              <td rowSpan={3} className="border border-black px-3 py-2 font-bold w-1/4">Employee/Consultant:</td>
              <td className="border border-black px-3 py-1.5 font-bold w-1/6">FirstName:</td>
              <td className="border border-black px-3 py-1.5">{firstName}</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5 font-bold">MiddleName:</td>
              <td className="border border-black px-3 py-1.5">{middleName}</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5 font-bold">LastName:</td>
              <td className="border border-black px-3 py-1.5">{lastName}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </div>
);

   const renderNonDisclosureAgreement = () => (
  <div className="max-w-4xl mx-auto p-10 mt-4  min-h-[1000px] bg-white print:p-16 print:text-xs print:max-w-none">
    {/* PAGE 1: Header and Identification Table */}
    <div className="bg-white p-16 print:p-10 min-h-[800px] page-break-after">
      <div className="mb-6">
        <h2 className="text-xl font-bold">
          Consultants / Employees Confidentiality and Non Disclosure Agreement
        </h2>
        <p className="mt-2 font-bold uppercase text-[12px] ">
          THIS CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT (the "Agreement") is entered into by and between
        </p>
      </div>

      <div className="overflow-x-auto mb-8">
        <table className="w-full border-collapse border border-black">
          <tbody>
            <tr>
              <td colSpan={2} className="border border-black px-3 py-1.5 font-bold">Brisk Olive Business Solutions Pvt Ltd</td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black px-3 py-1">(hereinafter referred to as the "Company")</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5 font-bold w-1/3">having an address at:</td>
              <td className="border border-black px-3 py-1.5">G 203 (First Floor), Sector 63, Noida (U.P.), India, PIN-201307</td>
            </tr>
            <tr><td colSpan={2} className="border border-black px-3 py-0.5 font-bold text-left">and</td></tr>
            <tr>
              <td className="border border-black px-3 py-1.5 font-bold">FirstName:</td>
              <td className="border border-black px-3 py-1.5">{firstName || '[Custom_First Name]'}</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5 font-bold">MiddleName:</td>
              <td className="border border-black px-3 py-1.5">{middleName || '[Custom_Middle Name]'}</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5 font-bold">Surname:</td>
              <td className="border border-black px-3 py-1.5">{lastName || '[Custom_Last Name]'}</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1">("the Employee/Consultant")</td>
              <td className="border border-black px-3 py-1.5"></td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5 font-bold">resident of:</td>
              <td className="border border-black px-3 py-1.5"></td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5 font-bold">on this:</td>
              <td className="border border-black p-0">
                <div className="flex">
                  <div className="flex-grow px-3 py-1.5 border-r border-black">{today}</div>
                  <div className="w-24 px-1 py-1 text-[9px] text-center flex items-center justify-center leading-tight">(the "Effective Date")</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <br></br>
        <p><strong>
         The Company and the Employee / Consultant are each herein individually referred to as "Party" or collectively as "Parties". The Parties hereby agree that the consideration for the due performance of their obligations under this Agreement is the mutual goodwill between the Parties and the possibility to carry on a mutually beneficial business relationship.
         </strong>
        </p>
    </div>
    <ol className="list-decimal pl-5 space-y-4">
      <li>
        Purpose: The purpose of this Agreement is to set forth the rights and obligations of the Employee with respect to the use, handling, protection, and safeguarding of Confidential Information which is disclosed by the Company, explicitly or otherwise, in the course of the employment of the Employee with the Company and during the development services that are needed by the Company (the "Purpose").
      </li>
      <li>
        Confidential Information: "Confidential Information" shall mean and include all information regarding the Company, its affiliates, or their respective products or services that in which they deal as a business and regarding which information is revealed to the in connection with the Purpose that is either: (i) designated in writing as confidential at the time of disclosure, (ii) designated as confidential by a written document describing the information previously disclosed within fifteen (15) days of the disclosure, or (iii) would be recognized by a reasonable person as being confidential information under the circumstances of such disclosure. Regardless if identified as confidential, the Company's Confidential Information shall include, but not be limited to: (1) oral and written information regarding any inventions, software, discoveries, developments, formulas, processes, methods, trade secrets, know-how, file layouts, databases, or innovations developed by or for the Company or its affiliates, (2) oral and written information which is used in the Company's business and is proprietary to, about, or created by the Company or its affiliates, including but not limited to financial information, market information, sales information, customer information, personnel information, and marketing strategies, (3) any customer data of the Company or its affiliates; or (4) this Agreement, the relationship between the parties hereunder any business arrangements discussed hereunder.
      </li>
      <li>
        Exclusions: Confidential Information shall not include (a) any information which at the time of disclosure is generally available to the public; (b) information which after disclosure becomes generally available to the public, other than through any act or omission by the Employee; (c) information which the Employee can show was in its possession at the time of disclosure and which was not acquired directly or indirectly from the Company; or (d) information rightfully received by the Employee from third parties who did not obtain such information under any obligations of confidentiality.
      </li>
      <li>
        Ownership of the Confidential Information: Ownership of all right, title and interest in the Confidential Information shall remain at all times with the Company and except for the limited rights to review the Confidential Information for the Purpose granted under this Agreement, nothing in this Agreement shall give any right, title or interest in any Confidential Information to the Employee. The Employee shall not alter or obliterate any notice of confidentiality and/or any propriety right on any copy of the Confidential Information. In the event any of the Confidential Information is modified, enhanced or a derivative work is created therefrom ("Modified Confidential Information"), the Company shall own all right, title and interest in the Modified Confidential Information and the Employee hereby assigns, transfers, and conveys all right, title and interest (including without limitation all copyrights and other intellectual property rights) in the Modified Confidential Information to the Company.
      </li>
      <li>
        Use Restrictions: The Employee shall:
        <ol style={{ listStyleType: 'lower-alpha', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>Use the Confidential Information only to the extent necessary to achieve the Purpose;</li>
            <li>Not disclose or provide any Confidential Information to any third party without the prior written consent of the Company;</li>
            <li>Protect the Confidential Information with at least the same degree of care that the Employee uses to protect his / her own confidential and proprietary information, but no less than a reasonable degree of care;</li>
            <li>Not copy or reproduce any of the Confidential Information except to the extent necessary to achieve the Purpose;</li>
            <li>Where legally permitted, provide the Company with prompt notice of any judicial or administrative order requiring the Employee to disclose the Confidential Information, permit, where legally permitted, the Company the opportunity to oppose or to place restrictions on such disclosure, and provide reasonable cooperation to the Company in its attempts to oppose or place restrictions on such disclosure; and</li>
            <li>Be fully liable for any breach of this Agreement by any third party that the Employee permits to access the Confidential Information.</li>
        </ol>
      </li>
      <li>Site Visits: In the event that the Employee visits any of the Company's or its affiliates’ facilities, the Employee agrees and acknowledges that any information learned by the Employee about the Company shall be considered Confidential Information that is subject to the terms and conditions of this Agreement.</li>
      <li>
        Remedies: The Employee acknowledges that the use or disclosure of the Confidential Information in violation of this Agreement shall give rise to irreparable injury to the Company, inadequately compensable in monetary damages. Accordingly, the Employee agrees that, in addition to any other legal or equitable remedies that may be available, the Company shall be entitled to equitable relief, including an injunction and specific performance, in the event of a breach or threatened breach of this Agreement by the Employee. In any action brought by the Company to enforce its rights hereunder, the Company is entitled to recover its reasonable attorneys' fees and costs of the action from the Employee. In addition, the Company shall be entitled to recover punitive damages from the Employee if the breach of this Agreement is willful, malicious, in bad faith or done with intent to unjustly enrich the Employee or any third party. The Company is also entitled to terminate the Employee’s employment with the Company, in case of breach of this agreement.
      </li>
      <li>Extension of Obligations beyond Termination (the Date of Resignation / Retirement / termination of Employment of the Employee):
        The obligations of the Employee shall extend beyond the date of resignation / retirement / termination / leaving the employment of the Company in any manner whatsoever. Upon request by the Company or upon termination of Employment, the Employee shall promptly destroy all of the Company's Confidential Information, including all copies thereof (in any media), in its possession and purge its computer systems of all such Confidential Information. Within fifteen (15) days of termination or request to destroy such Confidential Information, the Employee shall certify in a writing, signed by a duly authorized agent thereof, to the Company that it has complied in full with its obligation under this Agreement. The obligations of the Employee under this Agreement with respect to the use and secrecy of the Confidential Information shall remain in full force and effect for at least five (5) years after termination, and for as long as the Confidential Information remains secret and confidential and is not publicly available or publicly disclosed by the Company.
        </li>
      <li>
        Severability: If a court of competent jurisdiction makes a final determination that any provision of this Agreement (or any portion thereof) is invalid, illegal, or unenforceable for any reason whatsoever, and all rights to appeal the determination have been exhausted or the time to appeal the determination has expired:
</li>
      <ol style={{ listStyleType: 'lower-alpha', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
      <li>
        The validity, legality and enforceability of the remaining provisions of this Agreement shall not in any way be affected or impaired thereby; and
      </li>
      <li>To the fullest extent possible, the provisions of this Agreement shall be construed so as to give effect to the intent manifested by the provision held invalid, illegal or unenforceable
      </li>
      </ol>
      <li>
        Warranty: The Employee acknowledges that the Confidential Information is provided on an "as is" basis, without warranties of any kind. The Company, to the fullest extent permitted by law, disclaims all warranties, either express or implied, statutory or otherwise, including but not limited to any implied warranty of merchantability, non-infringement of third parties' rights, title, or fitness for particular purpose, or any warranty concerning the accuracy, reliability, completeness, or timeliness of the Confidential Information. The entire risk arising out of the use of the Confidential Information remains with the Employee.
    </li>
    <li>
        General: This Agreement grants only those rights expressly delineated herein. The Employee may not assign, delegate or transfer (whether as part of a merger, asset transfer, or other operation of law) any of its rights, duties or obligations, hereunder, in whole or in part, without the prior written consent of the Company. Any assignment in violation of this Section shall be null and void and be considered a material breach of this Agreement. This Agreement shall inure to the benefit of and be binding upon the Parties hereto, and their permitted successors and assigns. This Agreement may not be modified or altered except by written instrument duly executed by all Parties hereto. No failure or delay by either Party in exercising any right, power or privilege under this Agreement shall operate as a waiver thereof, nor shall any single or partial exercise thereof preclude any other or further exercise of any right, power or privilege hereunder. This Agreement shall be governed and construed in accordance with the laws of the State of India, without regard for any State's choice of law provisions to the contrary. Any and all actions arising under this Agreement or related to the Confidential Information shall be exclusively filed, exclusively maintained and exclusively litigated (including without limitation all depositions) in the State of New Delhi, India and the Parties hereby consent to the exclusive jurisdiction and exclusive venue of such courts and irrevocably waive all objections thereto.
 
    </li>
    <li>
        This Agreement contains the entire agreement of the Parties hereto with respect to the subject matter hereof and shall be deemed to supersede all prior and contemporaneous agreements, representations, and understandings whether written or oral and the same shall be deemed to have been merged into this Agreement. All causes of action accruing to the Company under this Agreement shall survive termination of this Agreement for any reason. This Agreement shall become effective upon the Effective Date. This Agreement may be signed in two counterparts, each of which shall be deemed an original and which shall together constitute one Agreement.

    </li>
      </ol>
      <p><strong>
        IN WITNESS WHEREOF, the Parties hereto have caused their duly authorized representatives to execute this Agreement and acknowledge that they have read, understand, and agreed to the terms and conditions of this Agreement.
        </strong></p>  
    </div>

      <div className="space-y-6">
        {/* Employee Signature Table */}
        <table className=" border-collapse border border-black">
      <tbody>
        <tr>
          <td className="border border-black px-3 py-2 font-bold w-1/6">Witness 1:</td>
          <td className="border border-black px-3 py-2 w-1/3"></td>
          <td className="border border-black px-3 py-2 font-bold w-1/6 text-center">Company:</td>
          <td className="border border-black px-3 py-2 font-bold">Brisk Olive Business Solutions Pvt Ltd</td>
        </tr>
      </tbody>
    </table>

    {/* Employee / Witness 2 Section */}
        <table className="w-full border-collapse border border-black">
        <tbody>
            <tr>
            <td rowSpan={3} className="border border-black px-3 py-2 font-bold w-1/6">Witness 2:</td>
            <td rowSpan={3} className="border border-black px-3 py-2 w-1/6"></td>
            <td rowSpan={3} className="border border-black px-3 py-2 font-bold w-1/6 text-center bg-gray-50">
                Employee/Consultant:
            </td>
            <td className="border border-black px-3 py-1.5 font-bold w-1/6">FirstName:</td>
            <td className="border border-black px-3 py-1.5">{firstName}</td>
            </tr>
            <tr>
            <td className="border border-black px-3 py-1.5 font-bold">MiddleName:</td>
            <td className="border border-black px-3 py-1.5">{middleName}</td>
            </tr>
            <tr>
            <td className="border border-black px-3 py-1.5 font-bold">LastName:</td>
            <td className="border border-black px-3 py-1.5">{lastName}</td>
            </tr>
        </tbody>
        </table>
    </div>
    </div>
);


  
  return (
  <div className="min-h-screen bg-gray-50 py-10 print:bg-white print:py-0">
    {type === 'salary-revision'
      ? renderSalaryRevisionLetter()
      : type === 'confirmation'
      ? renderConfirmationLetter()
      : type === 'consultant-contract'
      ? renderConsultantContractLetter()
      : type === 'salary-breakdown'
      ? renderSalaryBreakdownLetter()
      : type === 'non-compete-agreement'
      ? renderNonCompeteAgreement()
      : type === 'non-disclosure-agreement'
      ? renderNonDisclosureAgreement()
    //   : type === 'code-of-ethics'
    //   ? renderCodeOfEthics()

      : (
          <div className="p-10 text-center text-gray-600">
            Letter type '{type}' not implemented yet.
          </div>
        )}

    {/* Print Button */}
    <div className="fixed bottom-8 right-8 z-50 print:hidden">
      <button
        onClick={() => window.print()}
        className="px-8 py-4 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 transition text-lg font-medium"
      >
        Print / Save as PDF
      </button>
    </div>
  </div>
);
}