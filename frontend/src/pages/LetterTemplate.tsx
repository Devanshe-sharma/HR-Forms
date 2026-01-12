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
    <li></li>
    <li></li>

    </ol>

    {/* Closing (on page 2) */}
    <div className="mt-12 text-left">
      <p>For Brisk Olive Business Solutions Pvt Ltd</p>
      <p className="mt-6">Authorised Signatory</p>
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