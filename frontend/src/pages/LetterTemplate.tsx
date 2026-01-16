import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatSalary, formatDate } from '../utils/helpers'; 

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
  // const TOTAL_ROWS = 30;

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
          <p><strong>Signatures:</strong></p>
          <p><strong>Name:</strong> {employee.full_name}</p>
          <p><strong>Date:</strong> {today}</p>
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

  const renderCodeOfEthics = () => (
    <div className="max-w-4xl mx-auto p-10 mt- bg-white font-bold print:p-16 print:text-xs print:max-w-none">

      {/* Header */}
      <div className="text-center mb-4">
        <h2 className='text-[20px]'>
          Code of Ethics (Employees, Consultants, Contractual Staff)
        </h2>
      </div>

      {/* Main Content */}
      <ol className="list-decimal ml-4 space-y-2 text-justify">

        {/* 1 */}
        <li>
          <span className="font-bold">
            ADHERENCE TO COMPANY VISION, MISSION, VALUES AND GOALS:
          </span>{" "}
          Employees shall ensure that their work and actions are in alignment with
          the Vision, Mission and Goals of the Company, which are as follows:

          {/* a */}
          <ol className="list-[lower-alpha] ml-6 mt-1 space-y-1">
            <li>
              <span className="font-bold">MISSION:</span> To develop unique
              solutions, products and services, through Wisdom, Integrity and
              Technology
            </li>

            <li>
              <span className="font-bold">VALUES:</span> These shall serve as
              guidelines to persons at all levels in the Company:

              {/* i */}
              <ol className="list-[lower-roman] ml-6 mt-1 space-y-1">
                <li><span className="font-bold">WISDOM:</span> in all endeavors.</li>
                <li><span className="font-bold">INTEGRITY:</span> in approach – what we promise, we deliver. Ethical dealings.</li>
                <li><span className="font-bold">TECHNOLOGY focus:</span> a unique workplace, an exciting environment to innovate.</li>
                <li><span className="font-bold">ASSOCIATES:</span> equality at work.</li>

                {/* nested 1,2,3 */}
                <ol className="list-decimal ml-6 mt-1 space-y-1">
                  <li>
                    We have no employees. We are associates. Our associates’ needs,
                    wants and aspirations are important to us. We create strong
                    MOUs for growth and sharing. We create profits for self,
                    clients, as a route to our wants and aspirations.
                  </li>
                  <li>
                    Transparency, Flat Structure, Egalitarianism and Collaborative
                    Decision Making: We believe these four go together. We believe
                    in transparency in our dealings and expect the same from our
                    employees and associates. We are flat against hierarchy and
                    strive towards collaboration. Inflated egos are strictly not
                    permitted.
                  </li>
                  <li>Equal focus at work and play.</li>
                </ol>
              </ol>
            </li>

            <li>
              <span className="font-bold">VISION:</span> Be amongst top three
              producers of technology products, solutions, services and talent in
              India
            </li>

            <li>
              <span className="font-bold">GOALS:</span>

              <ol className="list-[lower-roman] ml-6 mt-1 space-y-1">
                <li>
                  By March 2020:
                  <ol className="list-decimal ml-6 mt-1 space-y-1">
                    <li>Known creator of unique technology solutions (amongst top 30 in India).</li>
                    <li>Own a product line (5 new products by March 2015).</li>
                    <li>
                      Lead in software services
                      <ol className="list-[lower-alpha] ml-6 mt-1">
                        <li>ERPs: Amongst top 30 by March 2015.</li>
                      </ol>
                    </li>
                    <li>Recognized creator of in-house talent.</li>
                  </ol>
                </li>

                <li>
                  By 2026: Amongst top 3 in our niche as technology solution providers.
                </li>
              </ol>
            </li>
          </ol>
        </li>
        <li>
          AWARENESS OF AND ADHERANCE TO COMPANY POLICIES AND PROCEDURES, INCLUDING DISCIPLINARY PROCEDURES:
          Employees shall keep themselves abreast of, and adhere to, Company Policies and Procedures, ignorance of which shall not be an acceptable reason for non-adherence.
        </li>
        <li>
          LOYALTY: Loyalty is two-way. We shall be loyal to our associates, while expecting the same from them, i.e., they shall keep the interests of their associates and group in mind at all times.
        </li>
        <li>
          OBLIGATION TO MAINTAIN SECRECY: Every employee shall maintain the strictest secrecy regarding the affairs of the Company, its associates OR subsidiaries wherever warranted and shall not divulge, directly or indirectly, any information of a confidential nature. The HR and Accounts Departments too shall ensure the utmost propriety while sharing information about employees’ emoluments with outside agencies like consultants, etc.

        </li>
        <li>
          CONFLICT OF INTEREST: As a general rule, employees should also be aware of, avoid and disclose situations where there may be a conflict of their interest or benefits with the interests or benefits of the Company. These include situations where there would be questions of:
          <ol className="list-[lower-alpha] ml-6 mt-1 space-y-1">
            <li>
              Preferential treatment or Loss of impartiality.
            </li>
            <li>
              Compromising company efficiency or business ethics.
            </li>
            <li>
              Placing personal interest or interests of relatives or acquaintances over Company’s.
            </li>
            <li>
              CORPORATE OPPORTUNITIES: Employees may not exploit for personal gain opportunities discovered through use of corporate property, information or position, unless the opportunity is disclosed fully in writing to the Company and approved in writing.
            </li>
            <li>
              OTHER SITUATIONS: Since other conflicts of interest may arise, it would be impractical to attempt to list all situations. If a proposed transaction or situation raises questions or doubts of a conflict, employees must consult the Head HR and Admin or Legal Head.
            </li>
          </ol>

        </li>
        <li>
          PAYMENTS OR GIFTS FROM OTHERS: Under no circumstances may Employees accept any offer, payment, promise to pay, or authorization to pay any money, gift, or anything of value from customers, vendors, consultants, etc., that is perceived as intended, directly or indirectly, to influence any business decision, any act or failure to act, any commitment of fraud, or opportunity for commitment of any fraud. Inexpensive gifts, infrequent business meals, celebratory events and entertainment, provided they are not excessive or create an appearance of impropriety, do not violate this policy.

          <div className="max-w-4xl mx-auto p-8 mt-8 bg-white font-serif leading-snug text-sm print:p-16 print:text-xs print:max-w-none"></div>

          Before accepting anything which may not qualify as inexpensive or token gift from any entity, the Head HR may be consulted. Gifts given by Company to or received from suppliers or customers, should be appropriate to the circumstances and never be of a kind that could create an appearance of impropriety.

        </li>
        <li>USE OF COMPANY MATERIALS: Use of Company Materials. All manuals, forms and Training materials are the copyright of the Company and cannot be copied or taken out without specific approval of the CEO or Director.</li>
        <li>ISSUE OF TESTIMONIALS, CERTIFICATES OF SERVICE, ETC.: Employees, in their individual capacity, shall not issue testimonials or certificates of service in respect of any Company employee / ex-employee – these shall be issued only by the HR Dept at the Corporate Office.</li>
        <li>INTERACTION WITH MEDIA INCLUDING PRESS OR TV OR RADIO: Directors or CEO of the company or any executive authorized by a Director shall be the only ‘Spokesperson’ who would interact with media, radio, press, etc. No other employee of the Company can represent the Company in any article or in a radio orTV broadcast etc.</li>
        <li>
          DISCLOSURE: Our policy is to provide full, fair, accurate, timely, and understandable disclosure in reports and documents that are filed with, or submitted to any outside agency and in our other public communications. Accordingly, Employees must ensure that they and others in the Company comply with the Company’s disclosure controls and procedures.
        </li>
        <li>
          COMPLIANCE WITH GOVERNMENT LAWS, RULES AND REGULATIONS: Employees must comply with all applicable governmental laws, rules and regulations. Employees must acquire appropriate knowledge of the legal requirements relating to their duties sufficiently, to enable them to recognize potential dangers, and to know when to seek advice. Employees must comply with the company’s internal policies. The Head HR and Admin and Legal Head, along with the Heads of various Departments or Business Units, will arrange training for those employees, who are discharging functions relating to compliance with the rules, laws, technical knowledge and research and development activities for their respective departments or units.
        </li>
        <li>
          VIOLATIONS OF THE CODE: Part of an officer's job, and ethical responsibility, is to help maintain this Code. Employees should be alert to possible serious violations and report these to the Head HR and Admin. and Legal Head. Employees must co-operate in any internal or external investigations of possible violations. Reprisal, threat, retribution or retaliation against any person who has, in good faith, reported a violation ior suspected violation of law, this Code, or Company policies, or against a person assisting in such investigation or process, is prohibited.
        </li>
        <li>
          The Company shall take appropriate action against any Employee whose actions are found to violate the Code or any other policy of the Company, after giving him a reasonable opportunity of being heard. Where laws have been violated, the Company will cooperate fully with the appropriate authorities and regulators.
        </li>
      </ol>
      <p className='mt-10'>For Brisk Olive Business Solutions Pvt Ltd</p>
      <p className='mt-20'>Authorized Signatory</p>

      <h4 className='mt-4'>ACKNOWLEDGMENT OF RECEIPT OF CODE OF ETHICS</h4>
      <p>(Please sign and return this form to the Head – HR and Administration for filing in the respective Employee’s Personal File.) I have received and read the Company's Code of Ethics for the Employees. I understand the standards and policies contained in the Code and understand that there may be additional policies or laws specific to my job. I agree to comply with the Code. If I have questions concerning the meaning or application of the Code, any Company policies, or the legal and regulatory requirements applicable to my job, I understand I can consult the Head – HR and Administration and Legal Head, and that my questions or reports to these sources will be maintained in confidence.
      </p>
      <div className="mt-6 space-y-1">
        <p>Signatures</p>

        <p>
          First Name: {firstName || "[First_Name_Custom]"}
        </p>

        {middleName?.trim() && (
          <p>
            Middle Name: {middleName}
          </p>
        )}

        <p>
          Surname: {lastName || "[Last_Name_Custom]"}
        </p>

        <p>
          Designation: {employee?.designation || "[Designation_Custom]"}
        </p>
      </div>


    </div>
  );

  const renderInternshipCertificate = () => (
    <div className="max-w-4xl mx-auto p-16 mt-16 bg-white font-serif leading-snug text-sm print:p-16 print:text-xs print:max-w-none">
      <h3 className="mt-12 mb-10 text-center space-y-12">Internship Certificate</h3>
      {/* Date */}
      <div className="mb-8">
        <p>Date: {today}</p>
      </div>

      {/* Salutation */}
      <div className="mb-8">
        <p>To whomsoever it may concern</p>
      </div>

      {/* Subject */}
      <div className="mb-12">
        <p className="font-bold decoration-1 underline-offset-4">
          Subject: Internship Certificate
        </p>
      </div>

      {/* Certification Body */}
      <div className="space-y-6 mb-20">
        <p>
          This is to certify that <strong>{employee.full_name}</strong> was working with us as
          <strong> {employee.designation || '[Custom_Position]'}</strong> from
          <strong> {formatDate(employee.joining_date)}</strong> to
          <strong> {formatDate(employee.exit_date) || '[Custom_End Date]'}</strong>.
        </p>

        <p>
          {firstName} is a responsible, hard working and honest person. The management was pleased with
          {employee.gender === 'Female' ? ' her ' : ' his '} performance and skills.
        </p>

        <p>
          We wish {employee.full_name} continued success in all future endeavors.
        </p>
      </div>

      {/* Closing */}
      <div className="mt-12 text-left space-y-12">
        <div>
          <p>For Brisk Olive Business Solutions Private Limited</p>
        </div>

        <div className="pt-8">
          <p>Authorized Signatory</p>
        </div>
      </div>
    </div>
  );

  const renderExperienceCertificate = () => (
    <div className="max-w-4xl mx-auto p-16 mt-16 bg-white font-serif leading-snug text-sm print:p-16 print:text-xs print:max-w-none">
      <h3 className="mt-12 mb-10 text-center space-y-12">Experience Certificate</h3>
      {/* Date */}
      <div className="mb-10">
        <p>Date: {today}</p>
      </div>

      {/* Salutation */}
      <div className="mb-10">
        <p className="font-bold">To Whomsoever It May Concern</p>
      </div>

      {/* Subject */}
      <div className="mb-12">
        <p className="font-bold">
          Subject: Work Experience Certificate
        </p>
      </div>

      {/* Certification Body */}
      <div className="space-y-6 mb-20 text-justify">
        <p>
          This is to certify that <strong>{employee.full_name}</strong> was working with us as
          <strong> {employee.designation || '[Custom_Designation]'}</strong> from
          <strong> {formatDate(employee.joining_date)}</strong> to
          <strong> {formatDate(employee.exit_date) || '[Custom_End date]'}</strong>.
        </p>

        <p>
          <strong>{firstName}</strong> is a responsible, hard working and honest person. The management
          was highly pleased and satisfied with <strong>{firstName}</strong>'s performance, skills and
          commitment to duty.
        </p>

        <p>
          We wish <strong>{employee.full_name}</strong> continued success in all future endeavors.
        </p>
      </div>

      {/* Closing */}
      <div className="mt-24 text-left space-y-16">
        <div>
          <p className="font-bold">For Brisk Olive Business Solutions Pvt Ltd</p>
        </div>
      </div>
    </div>
  );



  const renderAppointmentLetter = () => (
    <>
      {/* PAGE 1 */}
      <div className="p-8 max-w-4xl mx-auto text-[12px] leading-snug print:max-w-none print:page-break-after">
        <div className="bg-white p-8 print:p-8">
          {/* Strictly Confidential Heading */}
          <div className="text-center mb-3">
            <h2 className="text-lg uppercase pb-1">
              Strictly Personal & Confidential
            </h2>
          </div>

          {/* Header Section */}
          <div className="mb-4">
            <table className="text-[11px]">
              <tbody>
                <tr>
                  <td className="w-28 py-0.5">Date:</td>
                  <td className="py-0.5">{today}</td>
                </tr>
                <tr>
                  <td className="py-0.5">File Ref:</td>
                  <td className="py-0.5"></td>
                </tr>
                <tr>
                  <td className="py-0.5">First Name:</td>
                  <td className="py-0.5">{firstName}</td>
                </tr>
                <tr>
                  <td className="py-0.5">Middle Name:</td>
                  <td className="py-0.5">{middleName || ''}</td>
                </tr>
                <tr>
                  <td className="py-0.5">Last Name:</td>
                  <td className="py-0.5">{lastName}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Subject */}
          <p className="mb-3"><strong>Subject: Appointment Letter</strong></p>

          {/* Salutation */}
          <p className="mb-3">Dear {employee.full_name},</p>

          {/* Opening Paragraphs */}
          <div className="space-y-2 mb-3">
            <p>1. We are pleased to be offering you employment, on the terms and conditions listed below and in the following pages.</p>
            <p>2. This letter supersedes any other appointment / offer letter / letter of intent that may have been issued to you by us before the date of issue of this letter.</p>
            <p>3. Kindly note that the employment terms contained in this letter are subject to change as per Company Policy and that the changes shall be applicable to all employees in the Company.</p>
          </div>

          {/* Company Details Table */}
          <table className="w-full mb-3 text-[11px]">
            <tbody>
              <tr>
                <td className="w-1/3 py-0.5">Company/ID:</td>
                <td className="py-0.5">Brisk Olive Business Solutions Pvt Ltd (hereinafter referred to as the "Company")</td>
              </tr>
              <tr>
                <td className="py-0.5">Division/ID:</td>
                <td className="py-0.5"></td>
              </tr>
              <tr>
                <td className="py-0.5">Department/ID:</td>
                <td className="py-0.5">{employee.department || 'Operations'}</td>
              </tr>
              <tr>
                <td className="py-0.5">Designation/ID:</td>
                <td className="py-0.5">{employee.designation || 'Program Delivery Executive'}</td>
              </tr>
              <tr>
                <td className="py-0.5">Reporting To:</td>
                <td className="py-0.5">{employee.manager || '{Reporting manager}'}</td>
              </tr>
              <tr>
                <td className="py-0.5">Date:</td>
                <td className="py-0.5">{formatDate(employee.joining_date || today)}</td>
              </tr>
              <tr>
                <td className="py-0.5">Annual CTC:</td>
                <td className="py-0.5">{formatSalary(employee.annual_ctc || 374382)}</td>
              </tr>
              <tr>
                <td className="py-0.5">Details of CTC:</td>
                <td className="py-0.5 font-bold">Attached as Annexure 'A'</td>
              </tr>
              <tr>
                <td className="py-0.5">Benefits:</td>
                <td className="py-0.5 font-bold">As per Company Policy</td>
              </tr>
            </tbody>
          </table>

          {/* Section 4 */}
          <table className="w-full mb-3">
            <tbody>
              <tr className="align-top">
                <td className="w-1/3 py-0.5"><strong>4. Commitments:</strong></td>
                <td className="py-0.5">No other commitments are made by the Company in terms of your compensation or otherwise, other than what is mentioned in this appointment letter.</td>
              </tr>
            </tbody>
          </table>

          {/* Section 5 */}
          <p className="mb-2"><strong>5. Designation, Salary, Benefits, Taxes and Statutory Compliances:</strong></p>

          <table className="w-full mb-3">
            <tbody>
              <tr className="align-top">
                <td className="w-1/3 py-0.5"><strong>(a) Designation:</strong></td>
                <td className="py-0.5">Your designation is subject to change depending upon your work assignments.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5"><strong>(b) Revision of Salary:</strong></td>
                <td className="py-0.5">Your salary shall be revised from time to time inaccordance with the Performance Management Policy of the Company.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5"><strong>(c) Benefits</strong></td>
                <td className="py-0.5">In the event of the State / Central Government enacting any law conferring the same or similar benefits extended to you under this letter, you will be entitled to the more beneficial of the two, but not both.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5"><strong>(d) Tax Liability, Statutory Deductions:</strong></td>
                <td className="py-0.5">The emoluments / benefits due to you will be liable / subject to deduction of PF, ESIC deductions under Income Tax Act and Rules and other applicable laws, if any, as may be enforced from time to time.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5"><strong>(e) Statutory Compliances:</strong></td>
                <td className="py-0.5">The Company lays emphasis on all statutory compliances. Please ensure compliance with various statutes in your area of operations, including Insider Trading Regulations.</td>
              </tr>
            </tbody>
          </table>

          {/* Signature Section */}
          <div className="mt-8 grid grid-cols-2 gap-8">
            <div>
              <p className="font-bold mb-1">Signatures of Authorised Signatory:</p>
              <p className="mt-12">Date:</p>
            </div>
            <div>
              <p className="font-bold mb-1 text-right">Signatures of Appointee:</p>
              <p className="mt-12 text-right">Date:</p>
            </div>
          </div>
        </div>
      </div>


      {/* PAGE 2 */}
      {/* PAGE 2 */}
      <div className="p-8 max-w-4xl mx-auto text-[11px] leading-tight print:max-w-none">
        <div className="bg-white p-6 print:p-6">
          {/* Header */}
          <div className="text-center mb-3">
            <h2 className="text-base uppercase pb-1">
              Strictly Personal and Confidential
            </h2>
          </div>

          <p className="mb-2 font-bold">OTHER TERMS AND CONDITIONS OF APPOINTMENT (Continued)</p>

          {/* Section 6 */}
          <p className="mb-1.5"><strong>6. VERIFICATION OF QUALIFICATIONS, EXPERIENCE, REFERENCES, AGE, MEDICAL FITNESS, ADDRESS, ETC.</strong></p>

          <table className="w-full mb-2">
            <tbody>
              <tr className="align-top">
                <td className="w-10 py-0.5">a.</td>
                <td className="py-0.5"><strong>Qualification and Experience:</strong> Your appointment is solely based on your representation regarding your qualification and experience / testimonials handed over, which the Company has relied upon. In case, at any point in time, these are found to be incorrect, or it is found that you have concealed or withheld some relevant facts, you shall be liable for immediate termination without notice and without prejudice to all other rights of the Company. Further, you shall indemnify and hold the Company harmless from all cost, loss and damages that may have been caused to the Company due to such misrepresentation. By signing this letter, you also irrevocably consent to the Company initiating all necessary background checks as may be required during the course of your employment, either by the Company or through any third party.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5">b.</td>
                <td className="py-0.5"><strong>References:</strong> In case at any point in time, your representation regarding your references is not found satisfactory by the Company, you shall be liable for immediate termination without notice and without prejudice to all other rights of the Company.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5">c.</td>
                <td className="py-0.5"><strong>Date of Birth:</strong> The Matriculation / Higher Secondary Certificate / Birth Certificate copy provided by you, will be treated as conclusive proof of your Date of Birth.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5">d.</td>
                <td className="py-0.5"><strong>Medical Fitness:</strong> The Company has the right to get you medically examined by any certified medical practitioner during the period of your service. Your appointment is subject to your being declared (and remaining) medically fit by a Medical Officer or Doctor specified by the Company. In case, you are found medically unfit to continue with the job, you will lose your lien on the job.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5">e.</td>
                <td className="py-0.5"><strong>Details of Address:</strong> You will inform the Company in writing regarding any change of address within a week from the change of the same, failing which any communication sent on your last recorded address shall be deemed to have been served on you.</td>
              </tr>
            </tbody>
          </table>

          {/* Section 7 */}
          <p className="mb-1.5"><strong>7. PROBATION AND CONFIRMATION</strong></p>

          <table className="w-full mb-2">
            <tbody>
              <tr className="align-top">
                <td className="w-10 py-0.5">a.</td>
                <td className="py-0.5">You will be on probation for six months from the actual date of your joining the Company. Thereafter, if in the opinion of the Company, you are found suitable in the appointed post, you will be confirmed. The period of probation can be extended at the Management's discretion and you will continue to be on probation till an order of confirmation has been issued in writing.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5">b.</td>
                <td className="py-0.5"><strong>Notice Period to be given on Resignation / Termination of Service:</strong> In the event of your deciding to resign, you will be required to give the Management 30 days notice during probation and 60 days notice after confirmation. This shall commence from the date of receipt of the resignation letter (or the date of issue of the termination letter by the Company, in case acceptance is refused). This period is required for the company to recruit your replacement, for completing tasks in hand / planned tasks and to ensure smooth transition / handover of duties, without loss to the Company.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5">c.</td>
                <td className="py-0.5"><strong>Similarly,</strong> the Company may terminate the services of an individual without assigning any reasons, but with a similar notice period or salary in lieu thereof, except for the reasons specifically mentioned in this appointment letter or in the Discipline Policy / Code of Ethics. In case requisite notice is not given, either side will be liable to compensate the other, proportionately to the extent of gross salary and allowances due for the notice period or shortfall in notice period.</td>
              </tr>
            </tbody>
          </table>

          {/* Section 8 */}
          <p className="mb-1.5"><strong>8. DUTIES AND RESPONSIBILITIES</strong></p>

          <table className="w-full mb-3">
            <tbody>
              <tr className="align-top">
                <td className="w-10 py-0.5">a.</td>
                <td className="py-0.5"><strong>Full Time Employment:</strong> Your position is a full time employment and you shall devote yourself exclusively to the business and interests of the Company. You will not take up any other work, honorary, remuneratory or in an advisory capacity, part time or otherwise, in any other trade or business during your employment with the Company, without permission in writing from the Management of the Company. Any action to the contrary would render your services liable for termination, notwithstanding any other conditions in the appointment letter.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5">b.</td>
                <td className="py-0.5"><strong>Membership of any Local / Public bodies:</strong> You will not seek membership of any local or public bodies, without obtaining the Management's specific permission in writing.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5">c.</td>
                <td className="py-0.5"><strong>Company's Vision, Mission and Policies (that is, Service Rules and Regulations):</strong> Please ensure that you make yourself aware of the mission, vision and Policies (Service Rules and Regulations) of the Company, understand the scope and intent behind these and comply with the same, as they form an integral part of the terms of employment. These policies are updated periodically and new Policies are introduced. Whenever this happens, the Company will notify you and you will be required to comply with the same. These Policies are available in the Company Office.</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5">d.</td>
                <td className="py-0.5"><strong>Discipline and Code of Ethics:</strong> You are required to maintain the highest order of discipline and ethics as regards the work of the Company and / or its subsidiaries or associate companies and in case of any breach of discipline / trust, your services may be terminated by the Company with immediate effect. You are required to sign the Code of Ethics attached to this Appointment Letter (Annexure 'B')</td>
              </tr>
              <tr className="align-top">
                <td className="py-0.5">e.</td>
                <td className="py-0.5"><strong>Performance and Standards Expected:</strong> You will always be alive to responsibilities attached to your office and conduct yourself accordingly. You must perform to ensure results.</td>
              </tr>
            </tbody>
          </table>

          {/* Signature Section */}
          <div className="mt-6 grid grid-cols-2 gap-8">
            <div>
              <p className="font-bold mb-1">Signatures of Authorised Signatory:</p>
              <p className="mt-10">Date:</p>
            </div>
            <div>
              <p className="font-bold mb-1 text-right">Signatures of Appointee:</p>
              <p className="mt-10 text-right">Date:</p>
            </div>
          </div>
        </div>
      </div>
      {/* PAGE 3 */}
      <div className="p-8 pt-12 max-w-4xl mx-auto text-[10px] leading-tight print:max-w-none">
        <div className="bg-white p-6 print:p-6">
          {/* Header */}
          <div className="text-center mb-3">
            <h2 className="text-base uppercase pb-1">
              Strictly Personal and Confidential
            </h2>
          </div>

          {/* Section f */}
          <p className="mb-1.5"><strong>(f) Work Days, Hours and Leave Rules:</strong></p>
          <p className="mb-2">These shall be as per Company Policy and are subject to change from time to time.</p>

          {/* Section g */}
          <p className="mb-1.5"><strong>(g) Deputations, Postings, Transfers, etc.:</strong></p>
          <p className="mb-1">(i) Your services are liable to be transferred, at the sole discretion of Management, in such other capacity as the company may determine, to any department / section, location, associate, sister concern or subsidiary, at any place in India or abroad, whether existing today or which may come up in future. You are also liable to be sent on deputation for service at any station and in any company in which The Company or any of its subsidiary companies have an interest. In such a case, you will be governed by the terms and conditions of the service applicable at the new placement location.</p>
          <p className="mb-2">(ii) Depending upon your suitability, you may also be deputed from me to me to work at a Client of The Company or any of their clients at the client sites, whether in USA or elsewhere. In case of deputation with such a Company, you shall be treated as having bound yourself to serve that Company for the deputation period and for any stipulated period thereafter, and the same shall be treated as contract period vis-à-vis this contract of service. Accordingly you shall be required to sign a non-disclosure/confidentiality agreement with that Company.</p>

          {/* Section h */}
          <p className="mb-1.5"><strong>(h) Travel:</strong></p>
          <p className="mb-2">You will be required to undertake travel on Company work, for which you will be reimbursed travel expenses as per Company policy applicable to you.</p>

          {/* Section i */}
          <p className="mb-1.5"><strong>(i) Company Property / Assets:</strong></p>
          <p className="mb-2">You will be responsible for the safe keeping of all the properties of the Company which may be in your use, custody, care or charge and return these in good condition and order at the time of cessation of your employment with the Company, or whenever asked to do so. For the loss of any property of the Company in your possession, or in the event of your failure to account for such material or property to its satisfaction to the Company, it will have the right to assess on its own basis and recover the damages of all such material from you and to take such other action as it deemed proper.</p>

          {/* Section j */}
          <p className="mb-1.5"><strong>(j) Intellectual Property / Inventions / Innovations / Rights:</strong></p>
          <p className="mb-2">If you conceive any new or advanced method of improving designs/ processes/ formulae/ systems / innovations / inventions / discoveries / products, etc. made / developed during your employment with the Company, such developments will be fully communicated to the company and will be, and remain, the sole right/ property of the Company and you shall not make any claims on the said innovations / discoveries, etc.</p>

          {/* Section 9 */}
          <p className="mb-1.5"><strong>9. Confidentiality:</strong></p>

          {/* Section a */}
          <p className="mb-1"><strong>(a) Confidentiality of Information and Signing of Non-Disclosure Agreement:</strong></p>
          <p className="mb-2">You will not, at any time, during the employment or after, disclose or divulge or make public, any information regarding the Company's affairs or administration, security arrangements Confidential data, reports, technology, expertise, R and D activities or any business plans whether the same is confided to you or becomes known to you in the course of your service or otherwise, as this would impair the competitive position of the Company. Violation of this shall amount to Breach of Contract. To this effect, you will be expected to sign an Agreement of Non-Disclosure with the Company, within one week of issue of this letter (Annexure 'C'). If it is established that the above said information is passed on in any manner to anyone (unauthorized person within or outside the premises) during the employment, the Company shall be free to terminate your services without assigning any reason and without any compensation thereof, as also the Company would be free to recover damages from you, if any.</p>

          {/* Section b */}
          <p className="mb-1"><strong>(b) Confidentiality of Salary Information:</strong></p>
          <p className="mb-1">(i) Your salary package is based on, besides your overall experience level in the Industry, your educational qualifications and the experience and knowledge level assessed at the time of selection, particularly in the skill sets relevant. Therefore, the salary package offered to you is peculiar and personal to you. Any comparison of the same with the salary packages of other employees, based purely on the total experience level in the Industry, may be unrealistic, misleading and invidious.</p>
          <p className="mb-1">(ii) You are required to strictly maintain the secrecy of your compensation package and ensure that you do not divulge or communicate in any form or manner, any information relating to your terms of employment, to any other employee of the Company, excepting your immediate superior/ Head of the HR Dept. of the Company.</p>
          <p className="mb-1">(iii) In the same way, when deputed to work/release at the client site, you are expected to maintain full confidentiality regarding your salary packages, and are expected not to discuss or disclose the same to any member of the client staff, in the interest of maintaining and promoting good and ethical functional business relations with our clients.</p>
          <p className="mb-2">(iv) Your obligation to keep such information confidential shall survive even on termination or cancellation of the employment.</p>

          {/* Section 10 */}
          <p className="mb-1.5"><strong>10. Termination of Service:</strong></p>

          {/* Section a */}
          <p className="mb-1"><strong>(a) Retirement:</strong></p>
          <p className="mb-2">You will retire from the service of the Company on attaining the superannuating age of 60 years. Extension beyond the superannuating age shall be at the discretion of the management of the Company.</p>

          {/* Section b */}
          <p className="mb-1"><strong>(b) Absence Without Leave</strong></p>
          <p className="mb-2">If you absent yourself without leave or remain absent beyond the period of leave originally granted or subsequently extended, you shall be considered as having automatically terminated your employment, without giving any notice, unless you (i) return to work within eight days of the commencement of such absence; and (ii) give an explanation to the satisfaction of the Company / Business Unit regarding such absence.</p>

          {/* Section c */}
          <p className="mb-2"><strong>(c) Continued Ill Health:</strong> Your services are liable to be terminated without any notice or salary in lieu thereof in the case of continued ill health.</p>

          {/* Signature Section */}
          <div className="mt-6 grid grid-cols-2 gap-8">
            <div>
              <p className="font-bold mb-1">Signatures of Authorised Signatory:</p>
              <p className="mt-10">Date:</p>
            </div>
            <div>
              <p className="font-bold mb-1 text-right">Signatures of Appointee:</p>
              <p className="mt-10 text-right">Date:</p>
            </div>
          </div>
        </div>
      </div>

    </>
  );

  const renderOfferLetter = () => {
    // Always use today's date (dynamically generated)
    const today = formatDate(new Date().toISOString());

    return (
      <div className="max-w-4xl mx-auto p-12 bg-white font-serif leading-relaxed text-base print:p-8 print:text-sm print:max-w-none">
        {/* Strictly Personal & Confidential Heading */}
        <div className="text-center mb-8">
          <h2 className="text-xl tracking-wide pb-2">
            Strictly Personal & Confidential
          </h2>
        </div>

        {/* Date - Uses today's date automatically */}
        <div className="text-left mb-6">
          <p>Date: {today}</p>
        </div>

        {/* Full Name as address block */}
        <div className="mb-6">
          <p>{employee.full_name || '[Custom_Full_Name]'}</p>
        </div>

        {/* Subject */}
        <p className="mb-6 font-bold">
          SUBJECT: OFFER LETTER
        </p>

        {/* Salutation */}
        <p className="mb-6">
          Dear {employee.full_name || '[Custom_Full_Name]'},
        </p>

        {/* Main Body */}
        <p className="mb-4">
          We are pleased to offer you the position of <strong>{employee.designation || '[Custom_Designation]'}</strong> in Brisk Olive Business Solutions Pvt Ltd.
        </p>

        <p className="mb-4">
          Your date of joining shall be by <strong>{formatDate(employee.joining_date || today)}</strong>.
        </p>

        <p className="mb-4">
          As agreed, your CTC will be Rs. <strong>{formatSalary(employee.annual_ctc || '[Custom_CTC]')}</strong> per annum. Also enclosed is a break up of the Compensation being offered to you and a checklist for completing the joining formalities.
        </p>

        <p className="mb-4">
          We request you to sign the duplicate copy of this Offer Letter, and return it to the undersigned, indicating your acceptance of the offer. A formal Appointment Letter shall be issued to you on your joining.
        </p>

        <p className="mb-4">
          In case your signed acceptance is not received within two days of issue of this letter, this offer shall automatically lapse. The offer shall also lapse in case you do not report for work on or before the date.
        </p>

        <p className="mb-4">
          Please Note that this is only an offer letter. Your appointment shall be subject to your clearing the Medical Examination at the Company approved Hospital and satisfactory background check.
        </p>

        <p className="mb-4">
          Prior to beginning work at the Company, you are requested to report to the HR Department, which shall assist in completing the joining formalities.
        </p>

        <p className="mb-6">
          We are in an exciting phase of expansion and development and we believe that with your knowledge and skills, you will be able to make a significant contribution to the success of the Company.
        </p>

        {/* Closing */}
        <div className="mt-12 text-left">
          <p>For Brisk Olive Business Solutions Pvt Ltd</p>
          <p className="mt-8">Authorised Signatory</p>
        </div>

        {/* Candidate Confirmation */}
        <div className="mt-8">
          <p className="font-bold text-center">Candidate Confirmation</p>
          <p className="mt-4">
            I hereby accept the offer on the terms and conditions of employment discussed with you.
          </p>

          <div className="mt-8 space-y-2">
            <p><strong>Signatures:</strong></p>
            <p><strong>Name of the Candidate:</strong> {employee.full_name || '[Custom_Full Name]'}</p>
            <p><strong>Date:</strong> {today}</p>
          </div>

          <p className="mt-6 italic text-sm">
            (Pre-Employment Checklist as attached)
          </p>
        </div>
      </div>
    );
  };


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
                  : type === 'code-of-ethics'
                    ? renderCodeOfEthics()
                    : type === 'internship-certificate'
                      ? renderInternshipCertificate()
                      : type === 'experience-certificate'
                        ? renderExperienceCertificate()
                        // : type === 'exit-clearance'
                        //   ? renderExitClearance()
                          : type === 'Appointment-letter'
                            ? renderAppointmentLetter()
                            : type === 'offer-letter'
                              ? renderOfferLetter()

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