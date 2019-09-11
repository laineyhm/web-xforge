using SIL.XForge.Models;

namespace SIL.XForge.Scripture.Models
{
    public class ParatextProject
    {
        public string ParatextId { get; set; }
        public string Name { get; set; }
        public InputSystem InputSystem { get; set; } = new InputSystem();
        public string ProjectId { get; set; }
        public bool IsConnectable { get; set; }
        public bool IsConnected { get; set; }
    }
}
